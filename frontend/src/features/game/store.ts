import { create } from 'zustand'
import {
  api,
  type Game,
  type LogEntry,
  type MarketOverview,
  type Outcome,
  type StockAnalysis,
  type StockHistory,
  type TradeSide,
} from '../../api/client'
import {
  advanceDay,
  clockLimit,
  type Speed,
  secondsPerYear,
  shouldReport,
  totalDays,
} from './clock'
import { noticesOf } from './notices'

/** revealing: 태어나서 능력치가 공개되는 중. 사용자가 "인생 시작하기"를 누르면 playing이 된다. */
type Status = 'loading' | 'none' | 'revealing' | 'playing' | 'ended' | 'error'

interface GameState {
  status: Status
  game: Game | null
  /** 방금 한 선택의 결과. 사용자가 "계속"을 누를 때까지 보여 준다. */
  outcome: Outcome | null
  /**
   * 뉴스·흔들림의 선택 뒤 서버가 보낸 판. 결과 카드가 "실행 중"인 동안 총자산·보유가 먼저 바뀌어 결과가 새지 않도록, 결과가 드러날 때까지 화면에 반영하지 않고
   * 들고 있는다.
   */
  heldGame: Game | null
  /** 화면의 게임 일수. 시계가 흐르며 늘고, 서버에는 정수로 보고한다. */
  day: number
  running: boolean
  speed: Speed
  reporting: boolean
  choosing: boolean
  /** 매매창. 열려 있는 동안 시계는 멈춘다 (경제 개편 설계 8.1절). 연 순간 이벤트가 도착해도 닫히지 않는다 (매매창 설계 2절). */
  marketOpen: boolean
  /** 매매창의 탭: 시황, 보유, 섹터 코드. 처음은 보유 종목이 있으면 보유, 없으면 시황 (매매창 설계 2절). */
  marketTab: string
  selectedStock: string | null
  /** 시황. 매매창을 열 때 받는다. 달이 바뀌면 다시 받는다. */
  overview: MarketOverview | null
  /** 종목별 추세 사실과 해석. 종목을 고를 때 받아 둔다. 달이 바뀌면 비운다. */
  analyses: Record<string, StockAnalysis>
  /** histories·analyses·overview를 받은 달. 달이 바뀌면 전부 다시 받는다. */
  cachedMonth: number | null
  /** 방금 낸 주문의 결과. 패널 안에 한 줄로 보여 준다. */
  tradeOutcome: Outcome | null
  trading: boolean
  /** 종목별 월간 이력. 패널에서 종목을 고를 때 받아 둔다. */
  histories: Record<string, StockHistory>
  /** 아직 보여 주지 않은 알림(생활·세상 소식). 토스트가 맨 앞을 잠시 보여 주고 지운다. 한꺼번에 와도 덮이지 않는다 (#24). */
  notices: LogEntry[]
  load: () => Promise<void>
  born: () => Promise<void>
  startLife: () => void
  /** quantity는 뉴스의 매수·매도 수량. 없으면 서버 기본. */
  choose: (option: string, quantity?: number) => Promise<void>
  /** 결과 카드가 결과를 드러낼 때 부른다. 들고 있던 판을 화면에 반영한다. */
  revealOutcome: () => void
  dismissOutcome: () => void
  tick: (elapsedMs: number) => void
  pause: () => void
  resume: () => void
  openMarket: () => void
  closeMarket: () => void
  setMarketTab: (tab: string) => void
  selectStock: (code: string) => Promise<void>
  trade: (side: TradeSide, quantity: number) => Promise<void>
  dismissNotice: () => void
  /** 가진 아파트를 매물로 내놓거나 거둔다. 팔리는 것은 매수자가 나와야 한다 (주거 설계 3절). */
  listHome: (seq: number, listed: boolean) => Promise<void>
  /** 주담대를 현금으로 일시 상환한다 (decisions.md 58번). 실패하면 이유를 돌려준다. */
  repayMortgage: (seq: number, amount: number) => Promise<string | null>
}

export const MACRO_TAB = 'macro'
export const HELD_TAB = 'held'

export const useGameStore = create<GameState>((set, get) => {
  /** 서버가 보낸 판으로 화면을 맞춘다. 대기 중인 선택이 있거나 끝났거나 시장 패널이 열려 있으면 시계를 멈춘다. */
  const apply = (game: Game, keepRunning: boolean) =>
    set((state) => {
      const sameGame = state.game?.gameId === game.gameId
      const knownSeqs = new Set(sameGame ? state.game?.log.map((e) => e.seq) : [])
      // 알림은 판을 멈추지 않고 토스트로 차례로 지나간다. 자세한 것은 수첩의 "요즘 있었던 일"에 남는다 (#24).
      const toasts = noticesOf(sameGame ? game.log.filter((e) => !knownSeqs.has(e.seq)) : [])
      // 대기 중인 선택이 생겨도 열려 있는 매매창은 닫지 않는다. 창을 닫은 뒤에 선택이 보인다 (매매창 설계 2절).
      const marketOpen = state.marketOpen && game.status === 'ACTIVE'
      return {
        status: game.status === 'ENDED' ? 'ended' : 'playing',
        game,
        day: Math.max(sameGame ? state.day : 0, game.day),
        running: keepRunning && game.status === 'ACTIVE' && !game.pendingEvent && !marketOpen,
        marketOpen,
        notices: [...state.notices, ...toasts],
      }
    })

  /** 진행 중인 보고. 멈춤·패널 열기처럼 "지금 시각을 꼭 보고해야 하는" 호출은 이게 끝난 뒤 한 번 더 보고한다. */
  let inFlight: Promise<void> | null = null

  const report = async () => {
    const { game, day, reporting } = get()
    if (!game || reporting) {
      return
    }
    set({ reporting: true })
    inFlight = (async () => {
      const { data } = await api.POST('/api/games/{gameId}/advance', {
        params: { path: { gameId: game.gameId } },
        body: { day: Math.floor(day) },
      })
      set({ reporting: false })
      if (data) {
        apply(data, get().running)
        return
      }
      // 서버가 거부하면 서버의 상태가 기준이다. 다시 불러와 맞춘다.
      await get().load()
    })()
    await inFlight
    inFlight = null
  }

  /** 주기 보고가 진행 중이면 기다렸다가 다시 보고해, 서버가 화면의 현재 시각을 반드시 알게 한다. */
  const reportNow = async () => {
    if (inFlight) {
      await inFlight
    }
    await report()
  }

  /** 달이 바뀌면 이력·해석·시황을 다시 받아야 한다. 해석은 달마다 한 번 정해지기 때문이다 (매매창 설계 4.3절). */
  const resetCacheIfMonthChanged = (game: Game) => {
    if (get().cachedMonth !== game.market.month) {
      set({ cachedMonth: game.market.month, histories: {}, analyses: {}, overview: null })
    }
  }

  const loadOverview = async () => {
    const game = get().game
    if (!game) {
      return
    }
    resetCacheIfMonthChanged(game)
    if (get().overview) {
      return
    }
    const { data } = await api.GET('/api/games/{gameId}/market/overview', {
      params: { path: { gameId: game.gameId } },
    })
    if (data) {
      set({ overview: data })
    }
  }

  return {
    status: 'loading',
    game: null,
    outcome: null,
    heldGame: null,
    day: 0,
    running: false,
    speed: 1,
    reporting: false,
    choosing: false,
    marketOpen: false,
    marketTab: MACRO_TAB,
    selectedStock: null,
    overview: null,
    analyses: {},
    cachedMonth: null,
    tradeOutcome: null,
    trading: false,
    histories: {},
    notices: [],

    // 재접속하면 일시정지 상태로 이어한다. 상황을 보고 사용자가 계속을 누른다 (architecture.md 7절).
    load: async () => {
      const { data, response } = await api.GET('/api/games/current')
      if (data) {
        set({ outcome: null, heldGame: null })
        apply(data, false)
      } else if (response.status === 401 || response.status === 404) {
        set({ status: 'none', game: null, running: false })
      } else {
        set({ status: 'error', running: false })
      }
    },

    born: async () => {
      set({
        status: 'loading',
        running: false,
        outcome: null,
        heldGame: null,
        game: null,
        day: 0,
        marketOpen: false,
        tradeOutcome: null,
        histories: {},
        overview: null,
        analyses: {},
        cachedMonth: null,
        notices: [],
      })
      await api.POST('/api/sessions')
      const { data } = await api.POST('/api/games')
      if (data) {
        set({ status: 'revealing', game: data, day: data.day, running: false })
      } else {
        set({ status: 'error' })
      }
    },

    startLife: () => {
      const { game } = get()
      if (game) {
        apply(game, true)
      }
    },

    choose: async (option, quantity) => {
      const { game, choosing } = get()
      if (!game?.pendingEvent || choosing) {
        return
      }
      set({ choosing: true })
      const { data } = await api.POST('/api/games/{gameId}/events/{eventId}/choose', {
        params: { path: { gameId: game.gameId, eventId: game.pendingEvent.eventId } },
        body: quantity == null ? { option } : { option, quantity },
      })
      set({ choosing: false })
      if (data) {
        const kind = data.outcome.kind
        if (kind === 'NEWS' || kind === 'SHAKE') {
          set({ outcome: data.outcome, heldGame: data.game })
        } else {
          set({ outcome: data.outcome })
          apply(data.game, false)
        }
      } else {
        await get().load()
      }
    },

    revealOutcome: () => {
      const { heldGame } = get()
      if (heldGame) {
        set({ heldGame: null })
        apply(heldGame, false)
      }
    },

    dismissOutcome: () => {
      get().revealOutcome()
      set({ outcome: null })
      const { game, marketOpen } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent && !marketOpen) {
        set({ running: true })
      }
    },

    tick: (elapsedMs) => {
      const { game, day, running, speed, reporting } = get()
      if (!game || !running || game.pendingEvent) {
        return
      }
      const lastDay = totalDays(game.startAge, game.endAge, game.daysPerYear)
      const limit = clockLimit(lastDay, game.nextEventDay, game.day)
      const next = advanceDay(
        day,
        elapsedMs,
        speed,
        game.daysPerYear,
        limit,
        secondsPerYear(game.phase),
      )
      set({ day: next })
      // 보고 간격에 닿았거나 한계(다음 이벤트, 앞서가기 상한)에 막혔으면 보고한다. 상한에 막힌 동안은 응답이 올 때까지 시계가 선다.
      if (!reporting && (shouldReport(next, game.day) || next >= limit)) {
        void report()
      }
    },

    pause: () => {
      set({ running: false })
      if (get().game?.status === 'ACTIVE') {
        void reportNow()
      }
    },

    resume: () => {
      const { game, outcome, marketOpen } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent && !outcome && !marketOpen) {
        set({ running: true })
      }
    },

    // 매매창을 열면 시계를 멈추고 현재 시각을 보고해 가격·현금을 최신으로 맞춘다. 그 뒤 시황과 고른 종목의 분석을 받는다.
    openMarket: () => {
      const { game } = get()
      if (game?.status !== 'ACTIVE' || game.pendingEvent) {
        return
      }
      const selected =
        get().selectedStock ?? game.holdings[0]?.stockCode ?? game.market.stocks[0]?.code ?? null
      set({
        running: false,
        marketOpen: true,
        marketTab: game.holdings.length > 0 ? HELD_TAB : MACRO_TAB,
        tradeOutcome: null,
        selectedStock: selected,
      })
      void (async () => {
        await reportNow()
        await loadOverview()
        if (selected) {
          await get().selectStock(selected)
        }
      })()
    },

    closeMarket: () => {
      set({ marketOpen: false, tradeOutcome: null })
      const { game, outcome } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent && !outcome) {
        set({ running: true })
      }
    },

    setMarketTab: (tab) => set({ marketTab: tab }),

    selectStock: async (code) => {
      set({ selectedStock: code, tradeOutcome: null })
      const game = get().game
      if (!game) {
        return
      }
      resetCacheIfMonthChanged(game)
      const { histories, analyses } = get()
      const loads: Promise<void>[] = []
      if (!histories[code]) {
        loads.push(
          api
            .GET('/api/games/{gameId}/stocks/{stockCode}/history', {
              params: { path: { gameId: game.gameId, stockCode: code } },
            })
            .then(({ data }) => {
              if (data) {
                set((state) => ({ histories: { ...state.histories, [code]: data } }))
              }
            }),
        )
      }
      if (!analyses[code]) {
        loads.push(
          api
            .GET('/api/games/{gameId}/stocks/{stockCode}/analysis', {
              params: { path: { gameId: game.gameId, stockCode: code } },
            })
            .then(({ data }) => {
              if (data) {
                set((state) => ({ analyses: { ...state.analyses, [code]: data } }))
              }
            }),
        )
      }
      await Promise.all(loads)
    },

    trade: async (side, quantity) => {
      const { game, selectedStock, trading } = get()
      if (!game || !selectedStock || trading || quantity < 1) {
        return
      }
      set({ trading: true })
      const { data } = await api.POST('/api/games/{gameId}/trades', {
        params: { path: { gameId: game.gameId } },
        body: { stockCode: selectedStock, side, quantity },
      })
      set({ trading: false })
      if (data) {
        set({ tradeOutcome: data.outcome })
        apply(data.game, false)
      } else {
        await get().load()
      }
    },

    dismissNotice: () => set((state) => ({ notices: state.notices.slice(1) })),

    repayMortgage: async (seq, amount) => {
      const { game } = get()
      if (!game) {
        return null
      }
      await reportNow()
      const { data, error } = await api.POST('/api/games/{gameId}/homes/{seq}/repay', {
        params: { path: { gameId: game.gameId, seq } },
        body: { amount },
      })
      if (data) {
        apply(data, get().running)
        return null
      }
      await get().load()
      return (error as { message?: string } | undefined)?.message ?? '갚지 못했다'
    },

    listHome: async (seq, listed) => {
      const { game } = get()
      if (!game) {
        return
      }
      await reportNow()
      const { data } = await api.POST('/api/games/{gameId}/homes/{seq}/listing', {
        params: { path: { gameId: game.gameId, seq } },
        body: { listed },
      })
      if (data) {
        apply(data, get().running)
      } else {
        await get().load()
      }
    },
  }
})
