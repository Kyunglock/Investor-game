import { create } from 'zustand'
import { api, type Company } from '../../api/client'

type Status = 'loading' | 'ready' | 'error'

/** 거시경제 회의의 태도 (decisions.md 266번). */
export type Stance = 'AGGRESSIVE' | 'NEUTRAL' | 'DEFENSIVE'

interface RaisingState {
  status: Status
  /** 가장 최근 회사. 아직 차리지 않았으면 null. */
  company: Company | null
  busy: boolean
  /** 서버가 거절한 이유(400). 다음 요청에서 지운다. */
  error: string | null
  /** 방금 4분기를 넘겨 연말 결산을 했다. 연말 결산서를 띄우고 닫으면 지운다. */
  justSettled: boolean
  /** 방금 한 분기를 넘겼다(4분기가 아니다). 분기 실적을 띄우고 닫으면 지운다 (decisions.md 268번). */
  justQuartered: boolean
  /** 자동 진행을 켰다 (245번). 새로 고치면 꺼진다: 모르는 사이에 돈을 쓰지 않게. */
  autoPlay: boolean
  /**
   * 자동 진행이 마지막으로 분기를 넘긴 때(ms). 켤 때도 지금으로 맞춘다: 켠 뒤 첫 분기도, 그 뒤 분기마다도 20초는 둔다 (decisions.md 273번).
   */
  autoLastSettleAt: number | null
  /** 자동 진행이 다음 분기를 넘길 때(ms). 화면이 남은 초를 센다. 기다리는 중이 아니면 null. */
  autoNextAt: number | null
  /** 회사 화면에서 고른 탭. null이면 화면이 정한다 (231번). */
  tab: 'meeting' | 'market' | 'staff' | 'settlement' | 'history' | null
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 망한 회사를 닫고 사장의 사재로 다음 회사를 차린다 (decisions.md 247번). 세션은 그대로다. */
  restart: () => Promise<void>
  /** 계약금을 내고 공채 시장의 지원자를 뽑는다. 자리가 꽉 찼으면 replace의 직원을 내보낸다. */
  hire: (applicantId: number, replace?: number) => Promise<void>
  /** 값을 내고 올해 지원자를 새로 받는다. */
  refreshApplicants: () => Promise<void>
  /** 올해 이직 제안에 답한다: 붙잡거나 보낸다 (decisions.md 262번). */
  answerPoach: (keep: boolean) => Promise<void>
  /** 올해 연봉 협상에 답한다: 올려 주거나 동결한다 (decisions.md 270번). */
  answerRaise: (accept: boolean) => Promise<void>
  /** 올해 투자 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 249번). 됐으면 true. */
  convene: () => Promise<boolean>
  /** 올해 종목 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). big이면 크게 한다 (260번). */
  decideInvest: (choice: string, big?: boolean) => Promise<void>
  /** 올해 거시경제 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 266번). 됐으면 true. */
  conveneMacro: () => Promise<boolean>
  /** 올해 거시경제 회의에서 회사의 태도를 고른다. 고르면 직원이 종목을 물어 올 수 있다 (266·267번). */
  decideMacro: (stance: Stance) => Promise<void>
  place: (seats: { employeeId: number; desk: string | null }[]) => Promise<void>
  /** 그 자리의 팀장을 정한다 (decisions.md 269번). */
  appointLeader: (desk: string, employeeId: number) => Promise<void>
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
    justQuartered: false,
    autoPlay: false,
    autoLastSettleAt: null,
    autoNextAt: null,
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
      // 해와 지금까지 새로 받은 횟수를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 한 번만 낸다 (254번).
      await change(
        api.POST('/api/company/applicants/refresh', {
          body: { year: company.year, refreshes: company.refreshes },
        }),
      )
    },

    answerPoach: (keep) => change(api.POST('/api/company/poach', { body: { keep } })),

    answerRaise: (accept) => change(api.POST('/api/company/raise', { body: { accept } })),

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

    conveneMacro: async () => {
      if (get().company?.macro?.convened) {
        return true
      }
      await change(api.POST('/api/company/macro/open'))
      return Boolean(get().company?.macro?.convened)
    },

    decideMacro: (stance) => change(api.POST('/api/company/macro', { body: { stance } })),

    place: (seats) => change(api.POST('/api/company/placement', { body: { seats } })),

    appointLeader: (desk, employeeId) =>
      change(api.POST('/api/company/leader', { body: { desk, employeeId } })),

    settle: async () => {
      const before = get().company
      if (!before || get().busy) {
        return
      }
      // 넘길 해와 분기를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 서버가 한 분기만 넘긴다 (234·268번).
      await change(
        api.POST('/api/company/settle', {
          body: { year: before.year, quarter: before.quarter },
        }),
      )
      const after = get().company
      if (get().error || !after) {
        return
      }
      if (after.year > before.year) {
        set({ justSettled: true, justQuartered: false, tab: 'settlement' })
      } else if (after.quarter > before.quarter) {
        set({ justQuartered: true })
      }
    },
  }
})
