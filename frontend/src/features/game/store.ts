import { create } from 'zustand'
import {
  api,
  type Game,
  type LogEntry,
  type Outcome,
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
  /** 시장 패널. 열려 있는 동안 시계는 멈춘다 (경제 개편 설계 8.1절). */
  marketOpen: boolean
  selectedStock: string | null
  /** 방금 낸 주문의 결과. 패널 안에 한 줄로 보여 준다. */
  tradeOutcome: Outcome | null
  trading: boolean
  /** 종목별 월간 이력. 패널에서 종목을 고를 때 받아 둔다. */
  histories: Record<string, StockHistory>
  /** 방금 들어온 알림성 생활 이벤트. 토스트가 3초 뒤 지운다. */
  lastNotice: LogEntry | null
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
  setSpeed: (speed: Speed) => void
  openMarket: () => void
  closeMarket: () => void
  selectStock: (code: string) => Promise<void>
  trade: (side: TradeSide, quantity: number) => Promise<void>
  dismissNotice: () => void
}

export const useGameStore = create<GameState>((set, get) => {
  /** 서버가 보낸 판으로 화면을 맞춘다. 대기 중인 선택이 있거나 끝났거나 시장 패널이 열려 있으면 시계를 멈춘다. */
  const apply = (game: Game, keepRunning: boolean) =>
    set((state) => {
      const sameGame = state.game?.gameId === game.gameId
      const knownSeqs = new Set(sameGame ? state.game?.log.map((e) => e.seq) : [])
      const notices = game.log.filter((e) => e.kind === 'LIFE' && !knownSeqs.has(e.seq))
      // 대기 중인 선택이 생기면 시장 패널은 닫는다. 선택이 먼저다.
      const marketOpen = state.marketOpen && !game.pendingEvent && game.status === 'ACTIVE'
      return {
        status: game.status === 'ENDED' ? 'ended' : 'playing',
        game,
        day: Math.max(sameGame ? state.day : 0, game.day),
        running: keepRunning && game.status === 'ACTIVE' && !game.pendingEvent && !marketOpen,
        marketOpen,
        lastNotice: sameGame && notices.length > 0 ? notices[notices.length - 1] : state.lastNotice,
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
    selectedStock: null,
    tradeOutcome: null,
    trading: false,
    histories: {},
    lastNotice: null,

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
        lastNotice: null,
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

    setSpeed: (speed) => set({ speed }),

    // 패널을 열면 시계를 멈추고 현재 시각을 보고해 가격·현금을 최신으로 맞춘다.
    openMarket: () => {
      const { game } = get()
      if (game?.status !== 'ACTIVE' || game.pendingEvent) {
        return
      }
      const selected =
        get().selectedStock ?? game.holdings[0]?.stockCode ?? game.market.stocks[0]?.code ?? null
      set({ running: false, marketOpen: true, tradeOutcome: null, selectedStock: selected })
      void reportNow()
      if (selected) {
        void get().selectStock(selected)
      }
    },

    closeMarket: () => {
      set({ marketOpen: false, tradeOutcome: null })
      const { game, outcome } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent && !outcome) {
        set({ running: true })
      }
    },

    selectStock: async (code) => {
      set({ selectedStock: code, tradeOutcome: null })
      const { game, histories } = get()
      if (!game || histories[code]) {
        return
      }
      const { data } = await api.GET('/api/games/{gameId}/stocks/{stockCode}/history', {
        params: { path: { gameId: game.gameId, stockCode: code } },
      })
      if (data) {
        set((state) => ({ histories: { ...state.histories, [code]: data } }))
      }
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

    dismissNotice: () => set({ lastNotice: null }),
  }
})
