import { create } from 'zustand'
import { api, type Game } from '../../api/client'
import { advanceDay, type Speed, shouldReport, totalDays } from './clock'

type Status = 'loading' | 'none' | 'playing' | 'error'

interface GameState {
  status: Status
  game: Game | null
  /** 화면의 게임 일수. 시계가 흐르며 늘고, 서버에는 정수로 보고한다. */
  day: number
  /** 서버가 마지막으로 확인한 게임 일수. */
  reportedDay: number
  running: boolean
  speed: Speed
  reporting: boolean
  load: () => Promise<void>
  born: () => Promise<void>
  tick: (elapsedMs: number) => void
  pause: () => void
  resume: () => void
  setSpeed: (speed: Speed) => void
}

export const useGameStore = create<GameState>((set, get) => {
  // 새로 태어나면 바로 흐르고, 재접속하면 일시정지 상태로 이어한다. 상황을 보고 사용자가 계속을 누른다.
  const playing = (game: Game, running: boolean) =>
    set({
      status: 'playing',
      game,
      day: game.lastReportedDay,
      reportedDay: game.lastReportedDay,
      running,
    })

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
    if (data) {
      set({ game: data, reportedDay: data.lastReportedDay, reporting: false })
      return
    }
    // 서버가 거부하면 서버의 상태가 기준이다. 다시 불러와 맞춘다.
    set({ reporting: false })
    await get().load()
  }

  return {
    status: 'loading',
    game: null,
    day: 0,
    reportedDay: 0,
    running: false,
    speed: 1,
    reporting: false,

    load: async () => {
      const { data, response } = await api.GET('/api/games/current')
      if (data) {
        playing(data, false)
      } else if (response.status === 401 || response.status === 404) {
        set({ status: 'none', game: null, running: false })
      } else {
        set({ status: 'error', running: false })
      }
    },

    born: async () => {
      set({ status: 'loading', running: false })
      await api.POST('/api/sessions')
      const { data } = await api.POST('/api/games')
      if (data) {
        playing(data, true)
      } else {
        set({ status: 'error' })
      }
    },

    tick: (elapsedMs) => {
      const { game, day, running, speed, reportedDay } = get()
      if (!game || !running) {
        return
      }
      const lastDay = totalDays(game.startAge, game.endAge, game.daysPerYear)
      const next = advanceDay(day, elapsedMs, speed, game.daysPerYear, lastDay)
      set({ day: next, running: next < lastDay })
      if (shouldReport(next, reportedDay) || next >= lastDay) {
        void report()
      }
    },

    pause: () => {
      set({ running: false })
      void report()
    },

    resume: () => {
      if (get().game) {
        set({ running: true })
      }
    },

    setSpeed: (speed) => set({ speed }),
  }
})
