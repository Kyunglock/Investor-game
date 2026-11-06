import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import {
  autoChoice,
  autoHire,
  autoStance,
  isWindowStep,
  nextAutoStep,
  toggleAutoPlay,
  WINDOW_MS,
} from './autoPlay'
import { useRaisingStore } from './store'

function desk(code: string, statCode: string, trades = true) {
  return { code, name: code, statCode, trades, sector: null, hot: false, description: '' }
}

const grades = (v: string) => ({ insight: v, patience: v, courage: v, conviction: v, luck: v })

function company(over: Partial<Company> = {}): Company {
  return {
    status: 'ACTIVE',
    capital: 100_000_000,
    seats: 2,
    desks: [desk('bio', 'patience'), desk('day', 'courage'), desk('research', 'insight', false)],
    employees: [],
    applicants: [],
    meeting: { wanted: '' },
    invest: null,
    ...over,
  } as unknown as Company
}

const remark = (read: 'UP' | 'DOWN' | 'NEUTRAL') => ({ read })

describe('자동 진행 (decisions.md 245번)', () => {
  it('투자 회의는 직원 다수결, 같으면 지켜본다', () => {
    const invest = (reads: ('UP' | 'DOWN' | 'NEUTRAL')[]) =>
      ({ remarks: reads.map(remark) }) as unknown as NonNullable<Company['invest']>
    expect(autoChoice(invest(['UP', 'UP', 'DOWN']))).toBe('BUY')
    expect(autoChoice(invest(['DOWN', 'NEUTRAL']))).toBe('SELL')
    expect(autoChoice(invest(['UP', 'DOWN', 'NEUTRAL']))).toBe('HOLD')
  })

  it('거시경제 회의는 직원 다수결: 공격하자가 많으면 공격, 지키자가 많으면 방어, 같으면 중립 (266번)', () => {
    const macro = (reads: ('UP' | 'DOWN' | 'NEUTRAL')[]) =>
      ({ remarks: reads.map(remark) }) as unknown as NonNullable<Company['macro']>
    expect(autoStance(macro(['UP', 'UP', 'DOWN']))).toBe('AGGRESSIVE')
    expect(autoStance(macro(['DOWN', 'NEUTRAL']))).toBe('DEFENSIVE')
    expect(autoStance(macro(['UP', 'DOWN']))).toBe('NEUTRAL')
  })

  it('빈 자리에는 계약금이 자본의 25% 이하인 사람 가운데 종합 등급이 가장 높은 사람을 뽑는다', () => {
    const applicants = [
      { id: 1, overallGrade: 'C', fee: 10_000_000 },
      { id: 2, overallGrade: 'A', fee: 25_000_000 },
      { id: 3, overallGrade: 'S', fee: 40_000_000 },
    ]
    expect(autoHire(company({ applicants } as never))).toBe(2)
    const full = company({
      applicants,
      employees: [{ id: 9 }, { id: 8 }],
    } as never)
    expect(autoHire(full)).toBeNull()
  })

  it('한 해를 결산서 닫기 → 공채 → 배치 → 투자 회의 → 결산 순으로 돈다', () => {
    expect(nextAutoStep(company({ status: 'ENDED' }), false).kind).toBe('stop')
    expect(nextAutoStep(company({ broke: '금고가 비었다.' }), false).kind).toBe('stop')
    expect(nextAutoStep(company(), true).kind).toBe('closeYearEnd')
    // 분기 실적은 짧게 보여 주고 닫는다 (268번).
    expect(nextAutoStep(company(), false, true).kind).toBe('closeQuarter')
    // 이직 제안 (262·265번): 자동 진행은 직원을 보내지 않고 늘 남긴다.
    const poached = company({ meeting: { wanted: '', poach: { transferFee: 1 } } } as never)
    expect(nextAutoStep(poached, false)).toEqual({ kind: 'poach', keep: true })
    // 연봉 협상 (270번): 자동 진행은 올려 준다.
    const asked = company({ meeting: { wanted: '', raise: { after: 1 } } } as never)
    expect(nextAutoStep(asked, false)).toEqual({ kind: 'raise', accept: true })
    const hiring = company({ applicants: [{ id: 1, overallGrade: 'C', fee: 1 }] } as never)
    expect(nextAutoStep(hiring, false)).toEqual({ kind: 'hire', applicantId: 1 })
    const resting = company({
      employees: [{ id: 1, grades: grades('B'), desk: null }],
    } as never)
    expect(nextAutoStep(resting, false).kind).toBe('place')
    const seated = company({
      employees: [{ id: 1, grades: grades('B'), desk: 'bio' }],
      invest: { ready: true, convened: true, remarks: [remark('DOWN')] },
    } as never)
    expect(nextAutoStep(seated, false)).toEqual({ kind: 'invest', choice: 'SELL', big: false })
    // 크게 산다·판다는 뺐다 (279번): 모두 같은 쪽이어도 크게 하지 않는다.
    const agreed = {
      ...seated,
      invest: { ready: true, convened: true, remarks: [remark('UP'), remark('UP')] },
    }
    expect(nextAutoStep(agreed as never, false)).toEqual({
      kind: 'invest',
      choice: 'BUY',
      big: false,
    })
    // 한마디는 회의를 열어야 나온다 (249번): 열지 않았으면 먼저 연다.
    const closed = { ...seated, invest: { ...seated.invest, convened: false, remarks: [] } }
    expect(nextAutoStep(closed as never, false).kind).toBe('convene')
    expect(nextAutoStep({ ...seated, invest: null }, false).kind).toBe('settle')
    // 거시경제 회의가 종목 회의보다 먼저다 (266·267번): 열고, 다수결로 고른다.
    const macro = { ready: true, convened: false, remarks: [] }
    expect(nextAutoStep({ ...seated, macro } as never, false).kind).toBe('conveneMacro')
    const opened = { ...macro, convened: true, remarks: [remark('UP')] }
    expect(nextAutoStep({ ...seated, macro: opened } as never, false)).toEqual({
      kind: 'macro',
      stance: 'AGGRESSIVE',
    })
    const decided = { ...opened, ready: false }
    expect(nextAutoStep({ ...seated, macro: decided } as never, false).kind).toBe('invest')
  })
})

describe('자동 진행의 창마다 시간 (decisions.md 277번)', () => {
  it('분기 실적·연말 결산서·건물 알림은 20초 띄워 두고, 분기 넘기기는 기다리지 않는다', () => {
    expect(WINDOW_MS).toBe(20_000)
    expect(isWindowStep(nextAutoStep(company(), false, true))).toBe(true)
    expect(isWindowStep(nextAutoStep(company(), true))).toBe(true)
    expect(isWindowStep(nextAutoStep(company(), false, false, true))).toBe(true)
    expect(isWindowStep({ kind: 'settle' })).toBe(false)
    expect(isWindowStep({ kind: 'hire', applicantId: 1 })).toBe(false)
  })

  it('켜고 끄면 남은 시간을 지운다', () => {
    useRaisingStore.setState({ autoNextAt: 25_000 })
    toggleAutoPlay(true)
    expect(useRaisingStore.getState()).toMatchObject({ autoPlay: true, autoNextAt: null })
    useRaisingStore.setState({ autoNextAt: 25_000 })
    toggleAutoPlay(false)
    expect(useRaisingStore.getState()).toMatchObject({ autoPlay: false, autoNextAt: null })
  })
})

describe('엔딩 (decisions.md 276번)', () => {
  it('엔딩을 보면 멈춘다: 다음 회사는 사장이 직접 차린다', () => {
    const ended = { ...company(), ending: { year: 30, capital: 100_000_000_000_000, grade: 'Z' } }
    expect(nextAutoStep(ended as never, true).kind).toBe('closeYearEnd')
    expect(nextAutoStep(ended as never, false, false, true).kind).toBe('closeMove')
    expect(nextAutoStep(ended as never, false).kind).toBe('stop')
  })
})

describe('건물 이사 (decisions.md 296번)', () => {
  it('갈 수 있으면 사람을 뽑기 전에 먼저 이사한다', () => {
    const can = company({
      upgrade: { to: 'E', cost: 50_000_000, needed: 250_000_000, affordable: true },
      applicants: [{ id: 1, overallGrade: 'C', fee: 10_000_000 }],
    } as never)
    expect(nextAutoStep(can, false)).toEqual({ kind: 'upgrade' })
    const cannot = company({
      upgrade: { to: 'E', cost: 50_000_000, needed: 250_000_000, affordable: false },
      applicants: [{ id: 1, overallGrade: 'C', fee: 10_000_000 }],
    } as never)
    expect(nextAutoStep(cannot, false)).toEqual({ kind: 'hire', applicantId: 1 })
  })
})

describe('건물 알림 (decisions.md 281번)', () => {
  it('연말 결산서 다음에 건물 알림을 20초 띄우고 닫는다', () => {
    expect(nextAutoStep(company(), true, false, true).kind).toBe('closeYearEnd')
    const step = nextAutoStep(company(), false, false, true)
    expect(step.kind).toBe('closeMove')
    expect(isWindowStep(step)).toBe(true)
  })
})

describe('사표 (decisions.md 282번)', () => {
  it('사표를 들고 오면 자동 진행은 연봉을 올려 붙잡는다', () => {
    const c = {
      ...company(),
      resign: { employeeId: 1, name: '이도담', reason: 'FROZEN', line: '', before: 1, after: 2 },
    }
    expect(nextAutoStep(c as never, false)).toEqual({ kind: 'resign', keep: true })
  })
})

describe('막판 뒤집기 (decisions.md 283번)', () => {
  it('자동 진행은 막판 제안을 거절하고, 상벌 차례면 벌었을 때 연봉 인상·잃었을 때 봐준다', () => {
    const base = company()
    const proposed = {
      ...base,
      invest: {
        ready: true,
        convened: true,
        remarks: [],
        proposal: { employeeId: 1, name: '이도담', action: 'SELL', line: '' },
      },
    }
    expect(nextAutoStep(proposed as never, false)).toEqual({ kind: 'proposal', accept: false })
    const verdict = (good: boolean) => ({
      ...base,
      invest: {
        ready: false,
        convened: true,
        remarks: [],
        verdict: { employeeId: 1, name: '', good, ask: '', options: [{ code: 'X', label: '' }] },
      },
    })
    expect(nextAutoStep(verdict(true) as never, false)).toEqual({
      kind: 'verdict',
      choice: 'RAISE',
    })
    expect(nextAutoStep(verdict(false) as never, false)).toEqual({
      kind: 'verdict',
      choice: 'FORGIVE',
    })
  })
})
