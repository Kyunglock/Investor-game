import { create } from 'zustand'
import { api, type Run, type RunOutcome } from '../../api/client'

/** none: 아직 판이 없다(시작 화면). ended: 입사 심사가 끝난 판의 결과. */
type Status = 'loading' | 'none' | 'playing' | 'ended' | 'error'

interface RaisingState {
  status: Status
  run: Run | null
  /** 방금 고른 카드의 결과. "계속"을 누를 때까지 보여 준다. */
  outcome: RunOutcome | null
  /** 결과 카드가 떠 있는 동안 받아 둔 다음 판. 결과보다 먼저 총자산이 바뀌어 결과가 새지 않게 한다. */
  heldRun: Run | null
  busy: boolean
  load: () => Promise<void>
  start: () => Promise<void>
  choose: (option: string) => Promise<void>
  dismissOutcome: () => void
}

/** 요청이 끊기면(모바일에서 다른 앱에 다녀옴 등) 예외 대신 undefined. 버튼이 잠긴 채로 남지 않게 한다. */
async function safely<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request
  } catch {
    return undefined
  }
}

function statusOf(run: Run): Status {
  return run.status === 'ENDED' ? 'ended' : 'playing'
}

export const useRaisingStore = create<RaisingState>((set, get) => ({
  status: 'loading',
  run: null,
  outcome: null,
  heldRun: null,
  busy: false,

  load: async () => {
    const res = await safely(api.GET('/api/runs/current'))
    if (!res) {
      set({ status: 'error' })
      return
    }
    if (res.data) {
      set({ status: statusOf(res.data), run: res.data })
      return
    }
    set({ status: res.response.status === 401 || res.response.status === 404 ? 'none' : 'error' })
  },

  start: async () => {
    set({ busy: true })
    await safely(api.POST('/api/sessions'))
    const res = await safely(api.POST('/api/runs'))
    if (res?.data) {
      set({ status: 'playing', run: res.data, outcome: null, heldRun: null, busy: false })
    } else {
      set({ status: 'error', busy: false })
    }
  },

  choose: async (option) => {
    const { run, busy } = get()
    if (!run || busy) {
      return
    }
    set({ busy: true })
    const res = await safely(
      api.POST('/api/runs/{runId}/choose', {
        params: { path: { runId: run.runId } },
        body: { card: run.card, option },
      }),
    )
    if (!res?.data) {
      // 끊겼거나 이미 지나간 카드(두 번 누름)면 서버 상태로 다시 맞춘다.
      set({ busy: false })
      await get().load()
      return
    }
    const { outcome, run: next } = res.data
    // 입사 심사는 결과 화면이 곧 결과다.
    if (outcome.kind === 'EXAM') {
      set({ busy: false, run: next, status: statusOf(next) })
      return
    }
    set({ busy: false, outcome, heldRun: next })
  },

  dismissOutcome: () => {
    const { heldRun } = get()
    if (!heldRun) {
      set({ outcome: null })
      return
    }
    set({ outcome: null, heldRun: null, run: heldRun, status: statusOf(heldRun) })
  },
}))
