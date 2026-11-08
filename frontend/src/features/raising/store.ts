import { create } from 'zustand'
import { api, type Company } from '../../api/client'
import { moveOf } from './board'

type Status = 'loading' | 'ready' | 'error'

/** 멘탈 전투의 카드 코드 (decisions.md 328번). 이름·효과는 앱이 가진다. */
export type MentalCard = 'hold' | 'split' | 'rule' | 'steel' | 'calm' | 'heal'
export type WeaponKind = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle'
export type WeaponGrade = 'N' | 'R' | 'SR' | 'UR'

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
  /** 방금 연말 결산으로 건물이 바뀌었다(오르거나 줄었다). 연말 결산서를 닫으면 건물 알림이 뜨고, 닫으면 지운다 (decisions.md 281번). */
  moveAlert: boolean
  /** Capacity before the completed upgrade/settlement, for the app growth scene. */
  moveBeforeSeats: number | null
  /** 방금 채용 뽑기를 했다 (decisions.md 312번). 카드를 뒤집는 창을 띄우고 닫으면 지운다. 자동 진행 중에는 띄우지 않는다. */
  justDrew: boolean
  /** 방금 이사 비용을 내고 건물을 올렸다 (decisions.md 296번). 건물 알림을 띄우고 닫으면 지운다. */
  upgradeMove: {
    before: Company['grade']
    after: Company['grade']
    year: number
    beforeSeats?: number
  } | null
  /** 자동 진행을 켰다 (245번). 새로 고치면 꺼진다: 모르는 사이에 돈을 쓰지 않게. */
  autoPlay: boolean
  /** 자동 진행이 띄운 창(분기 실적·연말 결산서·건물 알림)을 닫을 때(ms). 화면이 남은 초를 센다. 창이 없으면 null (decisions.md 277번). */
  autoNextAt: number | null
  /** 회사 화면에서 고른 탭. null이면 화면이 정한다 (231번). */
  tab: 'meeting' | 'market' | 'staff' | 'settlement' | 'history' | null
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 망한 회사를 닫고 사장의 사재로 다음 회사를 차린다 (decisions.md 247번). 세션은 그대로다. */
  restart: () => Promise<void>
  /** 채용권으로 count명을 뽑는다 (decisions.md 312번). */
  draw: (count: number) => Promise<void>
  /** 직원을 내보낸다 (312번). */
  release: (employeeId: number) => Promise<void>
  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). */
  upgrade: () => Promise<void>
  /** 이번 분기 멘탈 전투의 결과를 보낸다 (decisions.md 328번). 강화율은 서버가 매긴다. */
  reportMental: (cards: MentalCard[], kills: number, mentalLeft: number) => Promise<void>
  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). */
  equipWeapon: (kind: WeaponKind, grade: WeaponGrade) => Promise<void>
  /** 멘탈 스테이지 한 판의 결과를 보낸다 (decisions.md 369번). 보상은 company.stages.lastResult. */
  reportStage: (stage: number, cleared: boolean, stars: number) => Promise<void>
  /** EX 디펜스 한 판의 결과를 보낸다 (decisions.md 369번). */
  reportEx: (kills: number) => Promise<void>
  /** 자본으로 전투 강화(데미지·연사·고양이 속도) 한 단계를 산다 (decisions.md 367번). */
  buyBattleUpgrade: (kind: 'damage' | 'fire' | 'speed') => Promise<void>
  /** 무기 뽑기권 한 장으로 무기 하나를 뽑는다 (decisions.md 366번). 결과는 company.armory.lastDraw. */
  drawWeapon: () => Promise<void>
  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). */
  mergeWeapon: (kind: WeaponKind, grade: Exclude<WeaponGrade, 'UR'>) => Promise<void>
  /** 올해 투자 회의를 연다: 직원 한마디와 형광펜을 굳힌다 (decisions.md 249번). 됐으면 true. */
  convene: () => Promise<boolean>
  /** 올해 종목 회의에서 고른다: BUY·SELL·HOLD (decisions.md 229번). big이면 크게 한다 (260번). */
  decideInvest: (choice: string, big?: boolean) => Promise<void>
  /** 분기 넘기기를 누르면 직원이 종목을 물어 온다 (decisions.md 267·382번). 물어 와 종목 회의를 열 수 있으면 true. */
  scout: () => Promise<boolean>
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
    justDrew: false,
    moveAlert: false,
    moveBeforeSeats: null,
    upgradeMove: null,
    autoPlay: false,
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

    draw: async (count) => {
      const before = get().company
      if (!before || get().busy) {
        return
      }
      // 지금까지 뽑은 횟수를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 한 번만 뽑는다 (254번과 같은 방식).
      await change(api.POST('/api/company/draws', { body: { count, draws: before.gacha.draws } }))
      const after = get().company
      if (!get().error && after && after.gacha.draws > before.gacha.draws) {
        set({ justDrew: !get().autoPlay })
      }
    },

    release: (employeeId) => change(api.POST('/api/company/release', { body: { employeeId } })),

    upgrade: async () => {
      const before = get().company
      if (!before || get().busy) {
        return
      }
      await change(api.POST('/api/company/upgrade'))
      const after = get().company
      if (after === before && !get().error) {
        set({ error: '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.' })
      }
      if (!get().error && after && after.grade !== before.grade) {
        set({
          upgradeMove: {
            before: before.grade,
            after: after.grade,
            year: after.year,
            beforeSeats: before.seats,
          },
        })
      }
    },

    reportMental: async (cards, kills, mentalLeft) => {
      const c = get().company
      if (!c) {
        return
      }
      await change(
        api.POST('/api/company/mental', {
          body: { year: c.year, quarter: c.quarter, cards, kills, mentalLeft },
        }),
      )
    },

    equipWeapon: (kind, grade) =>
      change(api.POST('/api/company/weapon', { body: { kind, grade } })),

    reportStage: (stage, cleared, stars) =>
      change(api.POST('/api/company/stage', { body: { stage, cleared, stars } })),

    reportEx: (kills) => change(api.POST('/api/company/ex', { body: { kills } })),

    buyBattleUpgrade: (kind) => change(api.POST('/api/company/battle-upgrade', { body: { kind } })),

    drawWeapon: () => change(api.POST('/api/company/weapon/draw')),

    mergeWeapon: (kind, grade) =>
      change(api.POST('/api/company/weapon/merge', { body: { kind, grade } })),

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

    scout: async () => {
      const invest = get().company?.invest
      if (!invest || invest.ready || invest.scouted) {
        return Boolean(invest?.ready)
      }
      await change(api.POST('/api/company/scout'))
      return Boolean(get().company?.invest?.ready)
    },

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
        set({
          justSettled: true,
          moveBeforeSeats: before.seats,
          justQuartered: false,
          tab: 'settlement',
          moveAlert: Boolean(
            after.lastSettlement &&
              moveOf(after.lastSettlement.gradeBefore, after.lastSettlement.gradeAfter),
          ),
        })
      } else if (after.quarter > before.quarter) {
        set({ justQuartered: true })
      }
    },
  }
})
