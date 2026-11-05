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
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 계약금을 내고 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. */
  hire: (applicantId: number, replace?: number) => Promise<void>
  /** 값을 내고 올해 지원자를 새로 받는다. */
  refreshApplicants: () => Promise<void>
  /** 올해 투자 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). */
  decideInvest: (choice: string) => Promise<void>
  place: (seats: { employeeId: number; desk: string | null }[]) => Promise<void>
  settle: () => Promise<void>
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
        set({ company: res.data, busy: false })
        return
      }
      set({ busy: false, error: reason(res?.error) })
      await get().load()
    },

    hire: (applicantId, replace) =>
      change(api.POST('/api/company/hires', { body: { applicantId, replace: replace ?? null } })),

    refreshApplicants: () => change(api.POST('/api/company/applicants/refresh')),

    decideInvest: (choice) =>
      change(
        api.POST('/api/company/invest', {
          body: { choice: choice as 'BUY' | 'SELL' | 'HOLD' },
        }),
      ),

    place: (seats) => change(api.POST('/api/company/placement', { body: { seats } })),

    settle: () => change(api.POST('/api/company/settle')),

    sell: (cofounders) => change(api.POST('/api/company/sale', { body: { cofounders } })),
  }
})
