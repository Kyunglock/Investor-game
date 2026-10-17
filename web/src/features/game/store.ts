import { create } from 'zustand'
import { api, type Game, type Outcome } from '../../api/client'
import { advanceDay, clockLimit, type Speed, shouldReport, totalDays } from './clock'

/** revealing: 태어나서 능력치가 공개되는 중. 사용자가 "인생 시작하기"를 누르면 playing이 된다. */
type Status = 'loading' | 'none' | 'revealing' | 'playing' | 'ended' | 'error'

interface GameState {
  status: Status
  game: Game | null
  /** 방금 한 선택의 결과. 사용자가 "계속"을 누를 때까지 보여 준다. */
  outcome: Outcome | null
  /** 화면의 게임 일수. 시계가 흐르며 늘고, 서버에는 정수로 보고한다. */
  day: number
  running: boolean
  speed: Speed
  reporting: boolean
  choosing: boolean
  load: () => Promise<void>
  born: () => Promise<void>
  startLife: () => void
  choose: (option: string) => Promise<void>
  dismissOutcome: () => void
  tick: (elapsedMs: number) => void
  pause: () => void
  resume: () => void
  setSpeed: (speed: Speed) => void
}

export const useGameStore = create<GameState>((set, get) => {
  /** 서버가 보낸 판으로 화면을 맞춘다. 대기 중인 선택이 있거나 끝났으면 시계를 멈춘다. */
  const apply = (game: Game, keepRunning: boolean) =>
    set((state) => ({
      status: game.status === 'ENDED' ? 'ended' : 'playing',
      game,
      day: Math.max(state.game?.gameId === game.gameId ? state.day : 0, game.day),
      running: keepRunning && game.status === 'ACTIVE' && !game.pendingEvent,
    }))

  const report = async () => {
    const { game, day, reporting } = get()
    if (!game || reporting) {
      return
    }
    set({ reporting: true })
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
  }

  return {
    status: 'loading',
    game: null,
    outcome: null,
    day: 0,
    running: false,
    speed: 1,
    reporting: false,
    choosing: false,

    // 재접속하면 일시정지 상태로 이어한다. 상황을 보고 사용자가 계속을 누른다 (architecture.md 7절).
    load: async () => {
      const { data, response } = await api.GET('/api/games/current')
      if (data) {
        set({ outcome: null })
        apply(data, false)
      } else if (response.status === 401 || response.status === 404) {
        set({ status: 'none', game: null, running: false })
      } else {
        set({ status: 'error', running: false })
      }
    },

    born: async () => {
      set({ status: 'loading', running: false, outcome: null, game: null, day: 0 })
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

    choose: async (option) => {
      const { game, choosing } = get()
      if (!game?.pendingEvent || choosing) {
        return
      }
      set({ choosing: true })
      const { data } = await api.POST('/api/games/{gameId}/events/{eventId}/choose', {
        params: { path: { gameId: game.gameId, eventId: game.pendingEvent.eventId } },
        body: { option },
      })
      set({ choosing: false })
      if (data) {
        set({ outcome: data.outcome })
        apply(data.game, false)
      } else {
        await get().load()
      }
    },

    dismissOutcome: () => {
      set({ outcome: null })
      const { game } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent) {
        set({ running: true })
      }
    },

    tick: (elapsedMs) => {
      const { game, day, running, speed, reporting } = get()
      if (!game || !running || game.pendingEvent) {
        return
      }
      const lastDay = totalDays(game.startAge, game.endAge, game.daysPerYear)
      const limit = clockLimit(lastDay, game.nextEventDay)
      const next = advanceDay(day, elapsedMs, speed, game.daysPerYear, limit)
      set({ day: next })
      if (!reporting && (shouldReport(next, game.day) || next >= limit)) {
        void report()
      }
    },

    pause: () => {
      set({ running: false })
      if (get().game?.status === 'ACTIVE') {
        void report()
      }
    },

    resume: () => {
      const { game, outcome } = get()
      if (game && game.status === 'ACTIVE' && !game.pendingEvent && !outcome) {
        set({ running: true })
      }
    },

    setSpeed: (speed) => set({ speed }),
  }
})
