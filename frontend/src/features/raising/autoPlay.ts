import { useEffect } from 'react'
import type { Company } from '../../api/client'
import { LADDER } from './grades'
import { autoPlace, type Seat } from './placement'
import { type Stance, useRaisingStore } from './store'

/** 자동 진행이 한 번에 하는 일 (decisions.md 245번). */
export type AutoStep =
  | { kind: 'closeYearEnd' }
  | { kind: 'closeQuarter' }
  | { kind: 'closeOvertake' }
  | { kind: 'hire'; applicantId: number }
  | { kind: 'poach'; keep: boolean }
  | { kind: 'raise'; accept: boolean }
  | { kind: 'place'; seats: Seat[] }
  | { kind: 'conveneMacro' }
  | { kind: 'macro'; stance: Stance }
  | { kind: 'convene' }
  | { kind: 'invest'; choice: 'BUY' | 'SELL' | 'HOLD'; big: boolean }
  | { kind: 'settle' }
  | { kind: 'stop' }

/** 계약금이 자본의 이만큼을 넘는 지원자는 뽑지 않는다. 한 해에 자본을 다 써 버리지 않게. */
const FEE_SHARE = 0.25

/** 크게 할까 (decisions.md 260번): 둘 이상이 한마디를 했고 모두 같은 쪽(사자 또는 팔자)이면 크게 한다. */
export function autoBig(invest: NonNullable<Company['invest']>): boolean {
  const reads = invest.remarks.map((r) => r.read)
  return reads.length >= 2 && reads.every((r) => r !== 'NEUTRAL' && r === reads[0])
}

/** 거시경제 회의 (decisions.md 266번): 직원 한마디의 다수결. 공격하자가 많으면 공격, 지키자가 많으면 방어, 같으면 중립. */
export function autoStance(macro: NonNullable<Company['macro']>): Stance {
  const up = macro.remarks.filter((r) => r.read === 'UP').length
  const down = macro.remarks.filter((r) => r.read === 'DOWN').length
  return up > down ? 'AGGRESSIVE' : down > up ? 'DEFENSIVE' : 'NEUTRAL'
}

/** 종목 회의: 직원 한마디의 다수결. 사자가 많으면 산다, 팔자가 많으면 판다, 같거나 모르겠다뿐이면 지켜본다. */
export function autoChoice(invest: NonNullable<Company['invest']>): 'BUY' | 'SELL' | 'HOLD' {
  const up = invest.remarks.filter((r) => r.read === 'UP').length
  const down = invest.remarks.filter((r) => r.read === 'DOWN').length
  return up > down ? 'BUY' : down > up ? 'SELL' : 'HOLD'
}

/** 빈 자리에 뽑을 지원자: 계약금이 자본의 25% 이하인 사람 가운데 종합 등급이 가장 높은 사람(같으면 싼 사람). */
export function autoHire(company: Company): number | null {
  if (company.employees.length >= company.seats) {
    return null
  }
  const affordable = company.applicants.filter((a) => a.fee <= company.capital * FEE_SHARE)
  const best = affordable.sort(
    (a, b) =>
      LADDER.indexOf(b.overallGrade as never) - LADDER.indexOf(a.overallGrade as never) ||
      a.fee - b.fee,
  )[0]
  return best?.id ?? null
}

/**
 * 자동 진행의 다음 일 (245번). 한 해를 사람이 하는 순서 그대로 돈다: 연말 결산서를 닫고(라이벌을 앞질렀으면 알림도, 274번) → 빈 자리에 뽑고 → 자동 배치(232·233번)와 다르면 앉히고 →
 * 거시경제 회의(직원 다수결, 266번) → 직원이 종목을 물어 왔으면 종목 회의(직원 다수결) → 분기 넘기기를 분기마다 되풀이한다(268번). 분기 실적은 짧게,
 * 연말 결산서는 길게 보여 주고 닫는다. 끝난 회사면 멈춘다.
 */
export function nextAutoStep(
  company: Company,
  justSettled: boolean,
  justQuartered = false,
  overtakeAlert = false,
): AutoStep {
  // 끝났거나 망한 회사(247번)면 멈춘다: 다시 차리기는 사장이 직접 한다.
  if (company.status === 'ENDED' || company.broke) {
    return { kind: 'stop' }
  }
  if (justSettled) {
    return { kind: 'closeYearEnd' }
  }
  // 라이벌을 앞질렀다는 알림 (274번): 연말 결산서 다음에 잠깐 보여 주고 닫는다.
  if (overtakeAlert) {
    return { kind: 'closeOvertake' }
  }
  if (justQuartered) {
    return { kind: 'closeQuarter' }
  }
  // 이직 제안 (262·265번): 자동 진행은 직원을 보내지 않는다. 늘 남긴다.
  if (company.meeting?.poach) {
    return { kind: 'poach', keep: true }
  }
  // 연봉 협상 (270번): 자동 진행은 올려 준다. 사기가 꺾이면 손이 더 뒤집힌다.
  if (company.meeting?.raise) {
    return { kind: 'raise', accept: true }
  }
  const applicantId = autoHire(company)
  if (applicantId !== null) {
    return { kind: 'hire', applicantId }
  }
  const seats = autoPlace(company)
  const desk = new Map(company.employees.map((e) => [e.id, e.desk ?? null]))
  if (seats.some((s) => desk.get(s.employeeId) !== s.desk)) {
    return { kind: 'place', seats }
  }
  if (company.macro?.ready) {
    // 거시경제 회의도 한마디는 열어야 나온다 (249·266번).
    if (!company.macro.convened) {
      return { kind: 'conveneMacro' }
    }
    return { kind: 'macro', stance: autoStance(company.macro) }
  }
  if (company.invest?.ready) {
    // 한마디는 회의를 열어야 나온다 (249번). 연 뒤에 다수결로 정한다.
    if (!company.invest.convened) {
      return { kind: 'convene' }
    }
    const choice = autoChoice(company.invest)
    return { kind: 'invest', choice, big: choice !== 'HOLD' && autoBig(company.invest) }
  }
  return { kind: 'settle' }
}

/** 한 일 사이의 쉼(ms). 연말 결산서는 장부가 다 드러날 때까지 둔다. */
const STEP_MS = 700
const QUARTER_MS = 1500
const YEAR_END_MS = 4000
const OVERTAKE_MS = 3000

/**
 * 자동 진행에서 분기와 분기 사이에 두는 시간(ms) (decisions.md 273번). 사용자: "자동버튼 누르면 20초는 텀두게해줘". 전에는 한 분기가 5초 남짓에 지나가
 * 회의 한마디·분기 실적을 읽을 틈이 없었다. 켠 때나 지난 분기를 넘긴 때부터 이만큼 지나야 다음 분기를 넘긴다. 뽑기·배치·회의는 그 사이에 하던 대로 한다.
 */
export const QUARTER_GAP_MS = 20_000

/** 분기 넘기기까지 기다릴 시간(ms): 켠 때·지난 분기를 넘긴 때부터 QUARTER_GAP_MS가 지나야 하고, 적어도 한 일 사이의 쉼은 둔다. */
export function settleDelay(lastSettleAt: number | null, now: number): number {
  if (lastSettleAt === null) {
    return STEP_MS
  }
  return Math.max(STEP_MS, lastSettleAt + QUARTER_GAP_MS - now)
}

/** 자동 진행을 켜고 끈다. 켤 때 분기 사이 시계를 지금부터 잰다 (273번). */
export function toggleAutoPlay(on: boolean, now = Date.now()) {
  useRaisingStore.setState(
    on
      ? { autoPlay: true, autoLastSettleAt: now, autoNextAt: null }
      : { autoPlay: false, autoNextAt: null },
  )
}

/**
 * 자동 진행 (245번). 켜 두면 회사 화면이 다시 그려져도(사람을 뽑거나 해가 바뀌어도) 이어지도록 앱 맨 위에서 돈다. 요청이 거절되면(오류) 멈춘다.
 */
export function useCompanyAutoPlay() {
  const auto = useRaisingStore((s) => s.autoPlay)
  const busy = useRaisingStore((s) => s.busy)
  const company = useRaisingStore((s) => s.company)
  const justSettled = useRaisingStore((s) => s.justSettled)
  const justQuartered = useRaisingStore((s) => s.justQuartered)
  const overtakeAlert = useRaisingStore((s) => s.overtakeAlert)
  const error = useRaisingStore((s) => s.error)
  useEffect(() => {
    if (!auto || busy || !company) {
      return
    }
    if (error) {
      useRaisingStore.setState({ autoPlay: false, autoNextAt: null })
      return
    }
    const step = nextAutoStep(company, justSettled, justQuartered, overtakeAlert)
    if (step.kind === 'stop') {
      useRaisingStore.setState({ autoPlay: false, autoNextAt: null })
      return
    }
    const delay =
      step.kind === 'settle'
        ? settleDelay(useRaisingStore.getState().autoLastSettleAt, Date.now())
        : step.kind === 'closeYearEnd'
          ? YEAR_END_MS
          : step.kind === 'closeQuarter'
            ? QUARTER_MS
            : step.kind === 'closeOvertake'
              ? OVERTAKE_MS
              : STEP_MS
    if (step.kind === 'settle') {
      useRaisingStore.setState({ autoNextAt: Date.now() + delay })
    }
    const {
      hire,
      place,
      convene,
      decideInvest,
      settle,
      answerPoach,
      answerRaise,
      conveneMacro,
      decideMacro,
    } = useRaisingStore.getState()
    const id = setTimeout(() => {
      switch (step.kind) {
        case 'closeYearEnd':
          useRaisingStore.setState({ justSettled: false })
          return
        case 'closeQuarter':
          useRaisingStore.setState({ justQuartered: false })
          return
        case 'closeOvertake':
          useRaisingStore.setState({ overtakeAlert: false })
          return
        case 'hire':
          void hire(step.applicantId)
          return
        case 'poach':
          void answerPoach(step.keep)
          return
        case 'raise':
          void answerRaise(step.accept)
          return
        case 'place':
          void place(step.seats)
          return
        case 'conveneMacro':
          void conveneMacro()
          return
        case 'macro':
          void decideMacro(step.stance)
          return
        case 'convene':
          void convene()
          return
        case 'invest':
          void decideInvest(step.choice, step.big)
          return
        case 'settle':
          useRaisingStore.setState({ autoLastSettleAt: Date.now(), autoNextAt: null })
          void settle()
      }
    }, delay)
    return () => clearTimeout(id)
  }, [auto, busy, company, justSettled, justQuartered, overtakeAlert, error])
}
