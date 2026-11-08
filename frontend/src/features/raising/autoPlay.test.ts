import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import {
  autoChoice,
  autoDraw,
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
    gacha: { tickets: 0, roster: 0, rosterMax: 4, draws: 0, maxDraws: 10, mergeCount: 3 },
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

  it('빈 자리만큼 채용권으로 뽑는다: 채용권·데리고 있을 자리가 허락하는 만큼 (312번)', () => {
    const gacha = (tickets: number, roster = 0, rosterMax = 4) => ({
      gacha: { tickets, roster, rosterMax, draws: 0, maxDraws: 10, mergeCount: 3 },
    })
    expect(autoDraw(company(gacha(5) as never))).toBe(2)
    expect(autoDraw(company(gacha(1) as never))).toBe(1)
    expect(autoDraw(company(gacha(0) as never))).toBeNull()
    expect(autoDraw(company({ ...gacha(5, 4, 4) } as never))).toBeNull()
    const full = company({ ...gacha(5, 2), employees: [{ id: 9 }, { id: 8 }] } as never)
    expect(autoDraw(full)).toBeNull()
  })

  it('한 해를 결산서 닫기 → 뽑기 → 배치 → 투자 회의 → 결산 순으로 돈다', () => {
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
    const hiring = company({
      gacha: { tickets: 3, roster: 0, rosterMax: 4, draws: 0, maxDraws: 10, mergeCount: 3 },
    } as never)
    expect(nextAutoStep(hiring, false)).toEqual({ kind: 'draw', count: 2 })
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
    // 분기 넘기기를 누르면 직원이 종목을 물어 온다 (267·382번): 아직 안 굴렸으면 먼저 굴리고, 굴렸는데 아무도 안 왔으면 넘긴다.
    const unscouted = { ...seated, invest: { ready: false, scouted: false, remarks: [] } }
    expect(nextAutoStep(unscouted as never, false).kind).toBe('scout')
    const nobody = { ...seated, invest: { ready: false, scouted: true, remarks: [] } }
    expect(nextAutoStep(nobody as never, false).kind).toBe('settle')
  })
})

describe('자동 진행의 창마다 시간 (decisions.md 277번)', () => {
  it('분기 실적·연말 결산서·건물 알림은 20초 띄워 두고, 분기 넘기기는 기다리지 않는다', () => {
    expect(WINDOW_MS).toBe(20_000)
    expect(isWindowStep(nextAutoStep(company(), false, true))).toBe(true)
    expect(isWindowStep(nextAutoStep(company(), true))).toBe(true)
    expect(isWindowStep(nextAutoStep(company(), false, false, true))).toBe(true)
    expect(isWindowStep({ kind: 'settle' })).toBe(false)
    expect(isWindowStep({ kind: 'draw', count: 1 })).toBe(false)
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

describe('엔딩 없음 (decisions.md 374번)', () => {
  it('랜드마크 타워(Z)에 올라도 멈추지 않는다', () => {
    const landmark = company({ grade: 'Z' })
    expect(nextAutoStep(landmark, false).kind).not.toBe('stop')
  })
})

describe('건물 이사 (decisions.md 296번)', () => {
  it('갈 수 있으면 사람을 뽑기 전에 먼저 이사한다', () => {
    const can = company({
      upgrade: { to: 'E', cost: 50_000_000, needed: 250_000_000, affordable: true },
      gacha: { tickets: 3, roster: 0, rosterMax: 4, draws: 0, maxDraws: 10, mergeCount: 3 },
    } as never)
    expect(nextAutoStep(can, false)).toEqual({ kind: 'upgrade' })
    const cannot = company({
      upgrade: { to: 'E', cost: 50_000_000, needed: 250_000_000, affordable: false },
      gacha: { tickets: 3, roster: 0, rosterMax: 4, draws: 0, maxDraws: 10, mergeCount: 3 },
    } as never)
    expect(nextAutoStep(cannot, false)).toEqual({ kind: 'draw', count: 2 })
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
