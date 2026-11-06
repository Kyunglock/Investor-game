import { useEffect } from 'react'
import type { Company } from '../../api/client'
import { LADDER } from './grades'
import { autoPlace, type Seat } from './placement'
import { type Stance, useRaisingStore } from './store'

/** 자동 진행이 한 번에 하는 일 (decisions.md 245번). */
export type AutoStep =
  | { kind: 'closeYearEnd' }
  | { kind: 'hire'; applicantId: number }
  | { kind: 'poach'; keep: boolean }
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
 * 자동 진행의 다음 일 (245번). 한 해를 사람이 하는 순서 그대로 돈다: 연말 결산서를 닫고 → 빈 자리에 뽑고 → 자동 배치(232·233번)와 다르면 앉히고 →
 * 거시경제 회의(직원 다수결, 266번) → 직원이 종목을 물어 왔으면 종목 회의(직원 다수결) → 결산. 끝난 회사면 멈춘다.
 */
export function nextAutoStep(company: Company, justSettled: boolean): AutoStep {
  // 끝났거나 망한 회사(247번)면 멈춘다: 다시 차리기는 사장이 직접 한다.
  if (company.status === 'ENDED' || company.broke) {
    return { kind: 'stop' }
  }
  if (justSettled) {
    return { kind: 'closeYearEnd' }
  }
  // 이직 제안 (262·265번): 자동 진행은 직원을 보내지 않는다. 늘 남긴다.
  if (company.meeting?.poach) {
    return { kind: 'poach', keep: true }
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
const YEAR_END_MS = 4000

/**
 * 자동 진행 (245번). 켜 두면 회사 화면이 다시 그려져도(사람을 뽑거나 해가 바뀌어도) 이어지도록 앱 맨 위에서 돈다. 요청이 거절되면(오류) 멈춘다.
 */
export function useCompanyAutoPlay() {
  const auto = useRaisingStore((s) => s.autoPlay)
  const busy = useRaisingStore((s) => s.busy)
  const company = useRaisingStore((s) => s.company)
  const justSettled = useRaisingStore((s) => s.justSettled)
  const error = useRaisingStore((s) => s.error)
  useEffect(() => {
    if (!auto || busy || !company) {
      return
    }
    if (error) {
      useRaisingStore.setState({ autoPlay: false })
      return
    }
    const step = nextAutoStep(company, justSettled)
    if (step.kind === 'stop') {
      useRaisingStore.setState({ autoPlay: false })
      return
    }
    const { hire, place, convene, decideInvest, settle, answerPoach, conveneMacro, decideMacro } =
      useRaisingStore.getState()
    const id = setTimeout(
      () => {
        switch (step.kind) {
          case 'closeYearEnd':
            useRaisingStore.setState({ justSettled: false })
            return
          case 'hire':
            void hire(step.applicantId)
            return
          case 'poach':
            void answerPoach(step.keep)
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
      },
      step.kind === 'closeYearEnd' ? YEAR_END_MS : STEP_MS,
    )
    return () => clearTimeout(id)
  }, [auto, busy, company, justSettled, error])
}
