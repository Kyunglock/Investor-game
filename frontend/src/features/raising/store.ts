import { create } from 'zustand'
import { api, type Company, type Run, type RunOutcome } from '../../api/client'

type Status = 'loading' | 'ready' | 'error'

interface RaisingState {
  status: Status
  /** 가장 최근 육성 판. 없으면 null. */
  run: Run | null
  /** 가장 최근 회사. 첫 사람을 등록하기 전이면 null (증권사 육성 설계 6.0절). */
  company: Company | null
  /** 방금 고른 카드의 결과. "계속"을 누를 때까지 보여 준다. */
  outcome: RunOutcome | null
  /** 결과 카드가 떠 있는 동안 받아 둔 다음 판. 결과보다 먼저 총자산이 바뀌어 결과가 새지 않게 한다. */
  heldRun: Run | null
  busy: boolean
  /** 서버가 거절한 이유(400). 다음 요청에서 지운다. */
  error: string | null
  load: () => Promise<void>
  start: () => Promise<void>
  choose: (option: string) => Promise<void>
  dismissOutcome: () => void
  /** 끝난 판의 사람을 등록하거나(register) 돌려보낸다. 자리가 꽉 찼으면 replace의 직원과 바꾼다. */
  hire: (register: boolean, replace?: number) => Promise<void>
  place: (seats: { employeeId: number; desk: string | null }[]) => Promise<void>
  settle: () => Promise<void>
  /** 인사팀이 올해 공채를 맡아 신입을 데려온다 (증권사 육성 설계 6.3절). */
  hrRecruit: () => Promise<void>
  /** 인사팀이 데려온 신입을 등록하거나 돌려보낸다. */
  decideCandidate: (register: boolean, replace?: number) => Promise<void>
  /** 회사를 팔고 공동창업자와 다음 회사를 차린다 (증권사 육성 설계 9절). */
  sell: (cofounders: number[]) => Promise<void>
}

/** 요청이 끊기면(모바일에서 다른 앱에 다녀옴 등) 예외 대신 undefined. 버튼이 잠긴 채로 남지 않게 한다. */
async function safely<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request
  } catch {
    return undefined
  }
}

/** 400 응답의 message. */
function reason(error: unknown): string | null {
  return (error as { message?: string } | undefined)?.message ?? null
}

export const useRaisingStore = create<RaisingState>((set, get) => ({
  status: 'loading',
  run: null,
  company: null,
  outcome: null,
  heldRun: null,
  busy: false,
  error: null,

  load: async () => {
    const [run, company] = await Promise.all([
      safely(api.GET('/api/runs/current')),
      safely(api.GET('/api/company')),
    ])
    if (!run || !company) {
      set({ status: 'error' })
      return
    }
    const ok = (s: number) => s === 200 || s === 401 || s === 404
    if (!ok(run.response.status) || !ok(company.response.status)) {
      set({ status: 'error' })
      return
    }
    set({ status: 'ready', run: run.data ?? null, company: company.data ?? null, busy: false })
  },

  start: async () => {
    set({ busy: true, error: null })
    await safely(api.POST('/api/sessions'))
    const res = await safely(api.POST('/api/runs'))
    if (res?.data) {
      set({ run: res.data, outcome: null, heldRun: null, busy: false })
      return
    }
    set({ busy: false, error: reason(res?.error) })
    await get().load()
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
      await get().load()
      return
    }
    const { outcome, run: next } = res.data
    // 입사 심사는 결과 화면이 곧 결과다.
    if (outcome.kind === 'EXAM') {
      set({ busy: false, run: next })
      return
    }
    set({ busy: false, outcome, heldRun: next })
  },

  dismissOutcome: () => {
    const { heldRun } = get()
    set({ outcome: null, heldRun: null, run: heldRun ?? get().run })
  },

  hire: async (register, replace) => {
    const { run } = get()
    if (!run) {
      return
    }
    set({ busy: true, error: null })
    const res = await safely(
      api.POST('/api/company/hires', {
        body: { runId: run.runId, register, replace: replace ?? null },
      }),
    )
    if (!res?.data) {
      set({ error: reason(res?.error) })
    }
    await get().load()
  },

  place: async (seats) => {
    set({ busy: true, error: null })
    const res = await safely(api.POST('/api/company/placement', { body: { seats } }))
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  },

  settle: async () => {
    set({ busy: true, error: null })
    const res = await safely(api.POST('/api/company/settle'))
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  },

  hrRecruit: async () => {
    set({ busy: true, error: null })
    const res = await safely(api.POST('/api/company/hr-recruit'))
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  },

  decideCandidate: async (register, replace) => {
    set({ busy: true, error: null })
    const res = await safely(
      api.POST('/api/company/candidate', { body: { register, replace: replace ?? null } }),
    )
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  },

  sell: async (cofounders) => {
    set({ busy: true, error: null })
    const res = await safely(api.POST('/api/company/sale', { body: { cofounders } }))
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  },
}))
