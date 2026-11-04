import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Game } from '../../api/client'

vi.mock('../../api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
}))

const { api } = await import('../../api/client')
const { useGameStore, withEarlierLog } = await import('./store')

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
    // 주 창은 판을 넘겨받으며(claim) 불러온다 (#189).
    vi.mocked(api.POST).mockResolvedValueOnce({ data: game(), response: { status: 200 } } as never)
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
    // 주 창은 판을 넘겨받으며(claim) 불러온다 (#189).
    vi.mocked(api.POST).mockResolvedValueOnce({ data: game(), response: { status: 200 } } as never)
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

/** 테스트 환경(node)에는 localStorage가 없어 메모리로 흉내 낸다. */
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})

describe('자동 진행', () => {
  it('켜면 저장되고 서 있던 시계를 돌리며, 끄면 시계는 그대로다', () => {
    useGameStore.setState({
      game: game({ day: 36 * YEAR }),
      day: 36 * YEAR,
      status: 'playing',
      running: false,
      autoPlay: false,
    })
    useGameStore.getState().setAutoPlay(true)
    expect(useGameStore.getState().autoPlay).toBe(true)
    expect(useGameStore.getState().running).toBe(true)
    useGameStore.getState().setAutoPlay(false)
    expect(useGameStore.getState().autoPlay).toBe(false)
    expect(useGameStore.getState().running).toBe(true)
  })

  it('새 판은 지난 판에 켜 둔 자동 진행을 끄고 수동으로 시작한다 (#191)', async () => {
    localStorage.setItem('investor-game.auto-play', 'on')
    useGameStore.setState({
      game: game({ day: 0 }),
      status: 'revealing',
      running: false,
      autoPlay: true,
    })
    vi.mocked(api.POST).mockResolvedValue({
      data: game({ day: 0 }),
      response: { status: 200 },
    } as never)
    expect(await useGameStore.getState().startLifeAs('경록')).toBeNull()
    expect(useGameStore.getState().autoPlay).toBe(false)
    expect(localStorage.getItem('investor-game.auto-play')).toBe('off')
  })

  it('이어하기는 켜 둔 자동 진행을 그대로 둔다 (#191)', async () => {
    localStorage.setItem('investor-game.auto-play', 'on')
    useGameStore.setState({ autoPlay: true })
    vi.mocked(api.GET).mockResolvedValue({
      data: game({ day: 36 * YEAR }),
      response: { status: 200 },
    } as never)
    await useGameStore.getState().load()
    expect(useGameStore.getState().autoPlay).toBe(true)
    expect(localStorage.getItem('investor-game.auto-play')).toBe('on')
  })
})

describe('자동 진행은 처음부터 켤 수 있다 (decisions.md 186번)', () => {
  it('15세 판에서도 켜고 끌 수 있고, 켜 둔 설정은 이어하기에서 그대로다', async () => {
    useGameStore.setState({
      game: game({ day: 0 }),
      day: 0,
      status: 'playing',
      running: false,
      autoPlay: false,
    })
    useGameStore.getState().setAutoPlay(true)
    expect(useGameStore.getState().autoPlay).toBe(true)
    expect(localStorage.getItem('investor-game.auto-play')).toBe('on')

    vi.mocked(api.GET).mockResolvedValue({ data: game(), response: { status: 200 } } as never)
    // 주 창은 판을 넘겨받으며(claim) 불러온다 (#189).
    vi.mocked(api.POST).mockResolvedValueOnce({ data: game(), response: { status: 200 } } as never)
    await useGameStore.getState().load()
    expect(useGameStore.getState().autoPlay).toBe(true)

    useGameStore.getState().setAutoPlay(false)
    expect(useGameStore.getState().autoPlay).toBe(false)
    expect(localStorage.getItem('investor-game.auto-play')).toBe('off')
  })

  it('판이 없으면 켜지지 않는다', () => {
    useGameStore.setState({ game: null, autoPlay: false })
    useGameStore.getState().setAutoPlay(true)
    expect(useGameStore.getState().autoPlay).toBe(false)
  })
})

describe('보고 응답은 새 기록만 (#192)', () => {
  const entry = (seq: number) => ({ seq, day: seq, kind: 'LIFE' as const, payload: {} })

  it('가진 기록 앞에 새 기록을 붙여 전체로 되돌린다', () => {
    const current = game({ log: [entry(1), entry(2)] } as Partial<Game>)
    const fresh = game({ log: [entry(3)] } as Partial<Game>)
    expect(withEarlierLog(fresh, current).log.map((e) => e.seq)).toEqual([1, 2, 3])
    expect(withEarlierLog(fresh, game({ gameId: 'other' })).log.map((e) => e.seq)).toEqual([3])
  })

  it('보고에 마지막 기록 번호를 실어 보내고 받은 새 기록을 이어 붙인다', async () => {
    vi.mocked(api.POST).mockReset()
    useGameStore.setState({
      game: game({ log: [entry(1), entry(2)] } as Partial<Game>),
      day: 20 * YEAR + 30,
      status: 'playing',
      running: false,
      reporting: false,
    })
    vi.mocked(api.POST).mockResolvedValue({
      data: game({ day: 20 * YEAR + 30, log: [entry(3)] } as Partial<Game>),
      response: { status: 200 },
    } as never)
    useGameStore.getState().pause()
    await vi.waitFor(() => expect(useGameStore.getState().game?.log.length).toBe(3))
    const body = vi.mocked(api.POST).mock.calls[0][1] as { body: { logAfter?: number } }
    expect(body.body.logAfter).toBe(2)
  })
})
