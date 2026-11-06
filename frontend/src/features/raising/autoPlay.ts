import { useEffect } from 'react'
import type { Company } from '../../api/client'
import { LADDER } from './grades'
import { autoPlace, type Seat } from './placement'
import { type Stance, useRaisingStore } from './store'

/** 자동 진행이 한 번에 하는 일 (decisions.md 245번). */
export type AutoStep =
  | { kind: 'closeYearEnd' }
  | { kind: 'closeQuarter' }
  | { kind: 'closeMove' }
  | { kind: 'hire'; applicantId: number }
  | { kind: 'upgrade' }
  | { kind: 'poach'; keep: boolean }
  | { kind: 'raise'; accept: boolean }
  | { kind: 'resign'; keep: boolean }
  | { kind: 'proposal'; accept: boolean }
  | { kind: 'verdict'; choice: string }
  | { kind: 'place'; seats: Seat[] }
  | { kind: 'conveneMacro' }
  | { kind: 'macro'; stance: Stance }
  | { kind: 'convene' }
  | { kind: 'invest'; choice: 'BUY' | 'SELL' | 'HOLD'; big: boolean }
  | { kind: 'settle' }
  | { kind: 'stop' }

/** 계약금이 자본의 이만큼을 넘는 지원자는 뽑지 않는다. 한 해에 자본을 다 써 버리지 않게. */
const FEE_SHARE = 0.25

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
 * 자동 진행의 다음 일 (245번). 한 해를 사람이 하는 순서 그대로 돈다: 연말 결산서를 닫고(건물이 바뀌었으면 건물 알림도, 281번) → 빈 자리에 뽑고 → 자동 배치(232·233번)와 다르면 앉히고 →
 * 거시경제 회의(직원 다수결, 266번) → 직원이 종목을 물어 왔으면 종목 회의(직원 다수결) → 분기 넘기기를 분기마다 되풀이한다(268번). 분기 실적은 짧게,
 * 연말 결산서는 길게 보여 주고 닫는다. 끝난 회사면 멈춘다.
 */
export function nextAutoStep(
  company: Company,
  justSettled: boolean,
  justQuartered = false,
  moveAlert = false,
): AutoStep {
  // 끝났거나 망한 회사(247번)면 멈춘다: 다시 차리기는 사장이 직접 한다.
  if (company.status === 'ENDED' || company.broke) {
    return { kind: 'stop' }
  }
  if (justSettled) {
    return { kind: 'closeYearEnd' }
  }
  // 건물 알림 (281번): 연말 결산서 다음에 보여 주고 닫는다.
  if (moveAlert) {
    return { kind: 'closeMove' }
  }
  // 랜드마크 타워 엔딩 (276번): 엔딩을 보면 멈춘다. 다음 회사는 사장이 직접 차린다.
  if (company.ending) {
    return { kind: 'stop' }
  }
  if (justQuartered) {
    return { kind: 'closeQuarter' }
  }
  // 이직 제안 (262·265번): 자동 진행은 직원을 보내지 않는다. 늘 남긴다.
  if (company.meeting?.poach) {
    return { kind: 'poach', keep: true }
  }
  // 사표 (282번): 자동 진행은 연봉을 올려 붙잡는다.
  if (company.resign) {
    return { kind: 'resign', keep: true }
  }
  // 연봉 협상 (270번): 자동 진행은 올려 준다. 사기가 꺾이면 손이 더 뒤집힌다.
  if (company.meeting?.raise) {
    return { kind: 'raise', accept: true }
  }
  // 건물 이사 (296번): 갈 수 있으면 먼저 간다. 돈을 쓰는 순서는 건물이 먼저다.
  if (company.upgrade?.affordable) {
    return { kind: 'upgrade' }
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
  // 막판 뒤집기 (283번): 자동 진행은 제 다수결을 지킨다. 따랐던 회의면(사장이 직접 따른 경우) 벌었으면 연봉을 올리고 잃었으면 봐준다.
  if (company.invest?.proposal) {
    return { kind: 'proposal', accept: false }
  }
  if ((company.invest?.verdict?.options.length ?? 0) > 0) {
    return { kind: 'verdict', choice: company.invest?.verdict?.good ? 'RAISE' : 'FORGIVE' }
  }
  if (company.invest?.ready) {
    // 한마디는 회의를 열어야 나온다 (249번). 연 뒤에 다수결로 정한다.
    if (!company.invest.convened) {
      return { kind: 'convene' }
    }
    const choice = autoChoice(company.invest)
    // 크게 산다·판다는 화면에서 뺐다 (decisions.md 279번).
    return { kind: 'invest', choice, big: false }
  }
  return { kind: 'settle' }
}

/** 한 일 사이의 쉼(ms). */
const STEP_MS = 700

/**
 * 자동 진행에서 창 하나를 띄워 두는 시간(ms) (decisions.md 277번). 사용자: "20초의 텀은 분기마다의 턴이 아니라 alert창마다의 시간이야". 분기 실적·연말
 * 결산서·건물 알림이 뜨면 이만큼 보여 준 뒤 닫는다. 그 전에 확인을 누르면 바로 넘어간다. 분기 넘기기·뽑기·배치·회의는 짧게만 쉰다.
 */
export const WINDOW_MS = 20_000

/** 자동 진행이 닫는 창인가: 분기 실적·연말 결산서·건물 알림. */
export function isWindowStep(step: AutoStep): boolean {
  return step.kind === 'closeQuarter' || step.kind === 'closeYearEnd' || step.kind === 'closeMove'
}

/** 자동 진행을 켜고 끈다. */
export function toggleAutoPlay(on: boolean) {
  useRaisingStore.setState({ autoPlay: on, autoNextAt: null })
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
  const moveAlert = useRaisingStore((s) => s.moveAlert)
  const upgradeMove = useRaisingStore((s) => s.upgradeMove)
  const error = useRaisingStore((s) => s.error)
  useEffect(() => {
    if (!auto || busy || !company) {
      return
    }
    if (error) {
      useRaisingStore.setState({ autoPlay: false, autoNextAt: null })
      return
    }
    const step = nextAutoStep(
      company,
      justSettled,
      justQuartered,
      moveAlert || upgradeMove !== null,
    )
    if (step.kind === 'stop') {
      useRaisingStore.setState({ autoPlay: false, autoNextAt: null })
      return
    }
    // 창은 20초 띄워 두고 닫는다 (277번). 화면이 남은 초를 센다.
    const shown = isWindowStep(step)
    const delay = shown ? WINDOW_MS : STEP_MS
    const nextAt = shown ? Date.now() + delay : null
    if (useRaisingStore.getState().autoNextAt !== nextAt) {
      useRaisingStore.setState({ autoNextAt: nextAt })
    }
    const {
      hire,
      upgrade,
      place,
      convene,
      decideInvest,
      settle,
      answerPoach,
      answerRaise,
      answerResign,
      answerProposal,
      giveVerdict,
      conveneMacro,
      decideMacro,
    } = useRaisingStore.getState()
    const id = setTimeout(() => {
      switch (step.kind) {
        case 'closeYearEnd':
          useRaisingStore.setState({ justSettled: false, autoNextAt: null })
          return
        case 'closeQuarter':
          useRaisingStore.setState({ justQuartered: false, autoNextAt: null })
          return
        case 'closeMove':
          useRaisingStore.setState({ moveAlert: false, upgradeMove: null, autoNextAt: null })
          return
        case 'upgrade':
          void upgrade()
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
        case 'resign':
          void answerResign(step.keep)
          return
        case 'proposal':
          void answerProposal(step.accept)
          return
        case 'verdict':
          void giveVerdict(step.choice)
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
          void settle()
      }
    }, delay)
    return () => clearTimeout(id)
  }, [auto, busy, company, justSettled, justQuartered, moveAlert, upgradeMove, error])
}
