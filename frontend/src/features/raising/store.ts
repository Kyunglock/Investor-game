import { create } from 'zustand'
import { api, type Company } from '../../api/client'

type Status = 'loading' | 'ready' | 'error'

interface RaisingState {
  status: Status
  /** 가장 최근 회사. 아직 차리지 않았으면 null. */
  company: Company | null
  busy: boolean
  /** 서버가 거절한 이유(400). 다음 요청에서 지운다. */
  error: string | null
  /** 방금 결산했다. 회사 화면이 결과로 스크롤하고 지운다. */
  justSettled: boolean
  /** 자동 진행을 켰다 (245번). 새로 고치면 꺼진다: 모르는 사이에 돈을 쓰지 않게. */
  autoPlay: boolean
  /** 회사 화면에서 고른 탭. null이면 화면이 정한다 (231번). */
  tab: 'meeting' | 'market' | 'staff' | 'settlement' | 'history' | null
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 망한 회사를 닫고 사장의 사재로 다음 회사를 차린다 (decisions.md 246번). 세션은 그대로다. */
  restart: () => Promise<void>
  /** 계약금을 내고 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. */
  hire: (applicantId: number, replace?: number) => Promise<void>
  /** 값을 내고 올해 지원자를 새로 받는다. */
  refreshApplicants: () => Promise<void>
  /** 올해 이직 제안에 답한다: 붙잡거나 보낸다 (decisions.md 261번). */
  answerPoach: (keep: boolean) => Promise<void>
  /** 올해 투자 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 248번). 됐으면 true. */
  convene: () => Promise<boolean>
  /** 올해 투자 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). big이면 크게 한다 (259번). */
  decideInvest: (choice: string, big?: boolean) => Promise<void>
  place: (seats: { employeeId: number; desk: string | null }[]) => Promise<void>
  settle: () => Promise<void>
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

export const useRaisingStore = create<RaisingState>((set, get) => {
  /** 회사를 바꾸는 요청. 끊기거나 거절되면 지금 회사를 그대로 두고 이유를 보인다. */
  const change = async (request: Promise<{ data?: Company; error?: unknown }>) => {
    set({ busy: true, error: null })
    const res = await safely(request)
    set({ busy: false, company: res?.data ?? get().company, error: reason(res?.error) })
  }

  return {
    status: 'loading',
    company: null,
    busy: false,
    error: null,
    justSettled: false,
    autoPlay: false,
    tab: null,

    load: async () => {
      const company = await safely(api.GET('/api/company'))
      if (!company) {
        set({ status: 'error' })
        return
      }
      const ok = (s: number) => s === 200 || s === 401 || s === 404
      if (!ok(company.response.status)) {
        set({ status: 'error' })
        return
      }
      set({ status: 'ready', company: company.data ?? null, busy: false })
    },

    open: async () => {
      set({ busy: true, error: null })
      await safely(api.POST('/api/sessions'))
      const res = await safely(api.POST('/api/company'))
      if (res?.data) {
        set({ company: res.data, busy: false, tab: null })
        return
      }
      set({ busy: false, error: reason(res?.error) })
      await get().load()
    },

    restart: async () => {
      set({ busy: true, error: null, autoPlay: false })
      const res = await safely(api.POST('/api/company'))
      if (res?.data) {
        set({ company: res.data, busy: false, tab: null, justSettled: false })
        return
      }
      set({ busy: false, error: reason(res?.error) })
    },

    hire: (applicantId, replace) =>
      change(api.POST('/api/company/hires', { body: { applicantId, replace: replace ?? null } })),

    refreshApplicants: async () => {
      const company = get().company
      if (!company || get().busy) {
        return
      }
      // 해와 지금까지 새로 받은 횟수를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 한 번만 낸다 (253번).
      await change(
        api.POST('/api/company/applicants/refresh', {
          body: { year: company.year, refreshes: company.refreshes },
        }),
      )
    },

    answerPoach: (keep) => change(api.POST('/api/company/poach', { body: { keep } })),

    convene: async () => {
      if (get().company?.invest?.convened) {
        return true
      }
      await change(api.POST('/api/company/invest/open'))
      return Boolean(get().company?.invest?.convened)
    },

    decideInvest: (choice, big = false) =>
      change(
        api.POST('/api/company/invest', {
          body: { choice: choice as 'BUY' | 'SELL' | 'HOLD', big },
        }),
      ),

    place: (seats) => change(api.POST('/api/company/placement', { body: { seats } })),

    settle: async () => {
      const year = get().company?.year
      if (year === undefined || get().busy) {
        return
      }
      // 결산할 해를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 서버가 한 해만 넘긴다 (234번).
      await change(api.POST('/api/company/settle', { body: { year } }))
      if (!get().error) {
        set({ justSettled: true, tab: 'settlement' })
      }
    },
  }
})
