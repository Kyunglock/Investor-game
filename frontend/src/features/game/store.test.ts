import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Game } from '../../api/client'

vi.mock('../../api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

const { api } = await import('../../api/client')
const { useGameStore } = await import('./store')

const YEAR = 360

/** 투자기의 판. 대기 중인 선택도, 다음 이벤트도 없어 시계가 한계까지 달린다. */
const game = (over: Partial<Game> = {}): Game =>
  ({
    gameId: 'g-1',
    status: 'ACTIVE',
    phase: 'INVESTING',
    day: 20 * YEAR,
    startAge: 15,
    endAge: 70,
    daysPerYear: YEAR,
    sex: 'M',
    stats: { insight: 50, patience: 50, courage: 50, conviction: 50, luck: 50 },
    initialStats: { insight: 50, patience: 50, courage: 50, conviction: 50, luck: 50 },
    cash: 1_000_000,
    totalAsset: 1_000_000,
    initialAsset: 1_000_000,
    invested: 0,
    debt: 0,
    holdings: [],
    fullTimeInvestor: false,
    market: { month: 240, stocks: [] },
    household: {
      married: false,
      children: [],
      monthlyIncome: 0,
      spouseIncome: 0,
      monthlyExpense: 0,
      retired: false,
      pension: 0,
      spouse: null,
    },
    housing: {
      tenure: 'MONTHLY',
      deposit: 0,
      monthlyRent: 0,
      jeonseLoan: 0,
      insured: false,
      mortgageRateBp: 550,
      monthlyCost: 0,
      homes: [],
      quotes: [],
    },
    pendingEvent: null,
    nextEventDay: null,
    log: [],
    yearly: [],
    ...over,
  }) as unknown as Game

const crisisEntry = {
  seq: 1,
  day: 20 * YEAR,
  kind: 'CRISIS' as const,
  payload: {
    name: '부동산 금융 위기',
    model: '2008년 리먼 브라더스 사태',
    severity: 'RECESSION',
    startAge: 33,
    endAge: 35,
    dropBp: 2_800,
    omens: [],
  },
}

describe('위기 회고 alert (decisions.md 60번, #71)', () => {
  beforeEach(() => {
    vi.mocked(api.GET).mockReset()
    vi.mocked(api.POST).mockReset()
  })

  it('회고가 오면 시계가 멈추고, 확인을 누르면 다시 흐른다', async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: game(), response: { status: 200 } } as never)
    const store = useGameStore.getState()
    await store.load()
    useGameStore.getState().resume()
    expect(useGameStore.getState().running).toBe(true)

    // 다음 보고에 위기 회고 기록이 실려 온다.
    vi.mocked(api.POST).mockResolvedValue({
      data: game({ day: 20 * YEAR + 30, log: [crisisEntry] }),
      response: { status: 200 },
    } as never)
    // 한계까지 달리면 보고한다.
    useGameStore.getState().tick(60 * 60 * 1000)
    await vi.waitFor(() => expect(useGameStore.getState().crisisAlert).not.toBeNull())
    expect(useGameStore.getState().running).toBe(false)
    expect(useGameStore.getState().crisisAlert?.kind).toBe('CRISIS')

    // 멈춘 동안은 시계를 켜려 해도 켜지지 않는다.
    useGameStore.getState().resume()
    expect(useGameStore.getState().running).toBe(false)

    useGameStore.getState().dismissCrisis()
    expect(useGameStore.getState().crisisAlert).toBeNull()
    expect(useGameStore.getState().running).toBe(true)
  })

  it('대기 중인 선택이 있으면 확인을 눌러도 시계는 선택이 끝날 때까지 서 있다', async () => {
    vi.mocked(api.GET).mockResolvedValue({ data: game(), response: { status: 200 } } as never)
    await useGameStore.getState().load()
    useGameStore.getState().resume()
    vi.mocked(api.POST).mockResolvedValue({
      data: game({
        day: 20 * YEAR + 30,
        log: [crisisEntry],
        pendingEvent: {
          eventId: 'e-1',
          kind: 'NEWS',
          occursDay: 20 * YEAR + 30,
          title: 't',
          body: 'b',
          options: [],
        } as unknown as Game['pendingEvent'],
      }),
      response: { status: 200 },
    } as never)
    useGameStore.getState().tick(60 * 60 * 1000)
    await vi.waitFor(() => expect(useGameStore.getState().crisisAlert).not.toBeNull())
    useGameStore.getState().dismissCrisis()
    expect(useGameStore.getState().running).toBe(false)
  })
})
