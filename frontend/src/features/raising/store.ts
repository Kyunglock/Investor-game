import { create } from 'zustand'
import { api, type Company } from '../../api/client'

type Status = 'loading' | 'ready' | 'error'

export type WeaponKind = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle'
export type WeaponGrade = NonNullable<Company['weapons']>[number]['grade']
export type ActiveCode = NonNullable<NonNullable<Company['idle']>['actives']>[number]['code']
export type CatCode = NonNullable<Company['idle']>['cats'][number]['code']

interface RaisingState {
  status: Status
  /** 가장 최근 회사. 아직 차리지 않았으면 null. */
  company: Company | null
  busy: boolean
  /** 서버가 거절한 이유(400). 다음 요청에서 지운다. */
  error: string | null
  /** 방금 채용 뽑기를 했다 (decisions.md 312번). 카드를 뒤집는 창을 띄우고 닫으면 지운다. */
  justDrew: boolean
  /** 방금 이사 비용을 내고 건물을 올렸다 (decisions.md 296번). 건물 알림을 띄우고 닫으면 지운다. */
  upgradeMove: {
    before: Company['grade']
    after: Company['grade']
    beforeSeats?: number
  } | null
  /** 튜토리얼이 가리키는 탭 (231번). null이면 화면이 정한다. */
  tab: 'meeting' | 'market' | 'staff' | null
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 채용권으로 count명을 뽑는다 (decisions.md 312번). */
  draw: (count: number) => Promise<void>
  /** 직원을 내보낸다 (312번). */
  release: (employeeId: number) => Promise<void>
  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). */
  upgrade: () => Promise<void>
  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). */
  equipWeapon: (kind: WeaponKind, grade: WeaponGrade) => Promise<void>
  /** 멘탈 스테이지 한 판의 결과를 보낸다 (decisions.md 369번). 보상은 company.stages.lastResult. */
  reportStage: (stage: number, cleared: boolean, stars: number) => Promise<void>
  /** 종목 회의 뒤 전투의 결과 (decisions.md 414번, #573). 별에 따라 회의 손익이 바뀐다. */
  reportInvestBattle: (mode: 'DEFENSE' | 'ASSAULT', stars: number) => Promise<void>
  /** 매도벽 돌파 스테이지 한 판의 결과를 보낸다 (#698). 결과는 company.assaults.lastResult. */
  reportAssault: (stage: number, cleared: boolean, stars: number) => Promise<void>
  /** EX 디펜스 한 판의 결과를 보낸다 (decisions.md 369번). */
  reportEx: (kills: number) => Promise<void>
  /**
   * 자본으로 전투 강화를 levels단계까지 산다 (decisions.md 367·394번). 꾹 눌러 연속으로 올리는 화면이 줄을 세워 부르므로 busy를 켜지 않는다. 받은
   * 회사(실패면 null)를 돌려준다.
   */
  buyBattleUpgrade: (
    kind: 'damage' | 'fire' | 'hp' | 'buy' | 'crit',
    levels?: number,
  ) => Promise<Company | null>
  /** 무기 뽑기권 한 장으로 무기 하나를 뽑는다 (decisions.md 366번). 결과는 company.armory.lastDraw. */
  /** count개를 한꺼번에 (10연속, 517번). 없으면 하나. */
  drawWeapon: (count?: number) => Promise<void>
  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). */
  mergeWeapon: (kind: WeaponKind, grade: Exclude<WeaponGrade, 'LR'>) => Promise<void>
  /** 자본으로 고양이 한 마리를 뽑는다 (decisions.md 488번). 받은 회사(실패면 null)를 돌려준다. */
  drawCat: (count?: number) => Promise<Company | null>
  /** 액티브 스킬을 쓴다 (decisions.md 503번). 서버가 받아 줬으면 true. 전투를 멈추지 않게 busy를 켜지 않는다. */
  useActive: (code: ActiveCode) => Promise<boolean>
  /** 코드를 넣고 테스트판에 들어간다 (decisions.md 499번). 안 되면 까닭을, 되면 null을 돌려준다. */
  enterSandbox: (code: string) => Promise<string | null>
  /** 테스트판에서 나와 본 게임의 회사를 다시 읽는다. */
  leaveSandbox: () => Promise<void>
  /** 테스트판: 고른 매도벽 앞으로 옮긴다. */
  jumpSandboxWall: (wall: number) => Promise<void>
  /** 테스트판: 회사를 처음부터 새로 차린다. */
  resetSandbox: () => Promise<void>
  /** 테스트판: 무한 지갑을 켜고 끈다. */
  setSandboxWallet: (infinite: boolean) => Promise<void>
  /** 테스트판: 고양이 여섯을 모두 그 레벨로 받는다. */
  grantSandboxCats: (level: number) => Promise<void>
  /** 테스트판: 그 등급의 무기를 받아 사장냥이 든다. */
  grantSandboxWeapon: (grade: WeaponGrade) => Promise<void>
  /** 가진 고양이를 출전시키거나 쉬게 한다 (488번). */
  fieldCat: (code: CatCode, fielded: boolean) => Promise<void>
  /** 고양이에게 가진 무기 하나를 들린다. weapon이 null이면 뺀다 (488번). */
  equipCat: (
    code: CatCode,
    weapon: { kind: WeaponKind; grade: WeaponGrade } | null,
  ) => Promise<void>
  /**
   * 종목회의를 연다 (#803): 기회 하나를 쓰고, 직원이 종목을 물어 오며 한마디와 형광펜이 굳는다. 아직 정하지 않은 회의가 있으면 그 회의다. 열렸으면
   * true, 기회가 없으면 false.
   */
  convene: () => Promise<boolean>
  /** 종목회의에서 고른다: BUY·SELL (decisions.md 229·423번). big이면 크게 한다 (260번). */
  decideInvest: (choice: string, big?: boolean) => Promise<void>
  place: (seats: { employeeId: number; desk: string | null }[]) => Promise<void>
  /** 그 자리의 팀장을 정한다 (decisions.md 269번). */
  appointLeader: (desk: string, employeeId: number) => Promise<void>
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
    justDrew: false,
    upgradeMove: null,
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

    draw: async (count) => {
      const before = get().company
      if (!before || get().busy) {
        return
      }
      // 지금까지 뽑은 횟수를 함께 보낸다: 두 번 눌리거나 끊긴 요청을 다시 보내도 한 번만 뽑는다 (254번과 같은 방식).
      await change(api.POST('/api/company/draws', { body: { count, draws: before.gacha.draws } }))
      const after = get().company
      if (!get().error && after && after.gacha.draws > before.gacha.draws) {
        set({ justDrew: true })
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
            beforeSeats: before.seats,
          },
        })
      }
    },

    equipWeapon: (kind, grade) =>
      change(api.POST('/api/company/weapon', { body: { kind, grade } })),

    reportStage: (stage, cleared, stars) =>
      change(api.POST('/api/company/stage', { body: { stage, cleared, stars } })),

    reportAssault: (stage, cleared, stars) =>
      change(api.POST('/api/company/assault', { body: { stage, cleared, stars } })),

    reportEx: (kills) => change(api.POST('/api/company/ex', { body: { kills } })),

    reportInvestBattle: (mode, stars) =>
      change(api.POST('/api/company/invest/battle', { body: { mode, stars } })),

    buyBattleUpgrade: async (kind, levels = 1) => {
      const res = await safely(api.POST('/api/company/battle-upgrade', { body: { kind, levels } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },

    drawWeapon: (count = 1) => change(api.POST('/api/company/weapon/draw', { body: { count } })),

    mergeWeapon: (kind, grade) =>
      change(api.POST('/api/company/weapon/merge', { body: { kind, grade } })),

    enterSandbox: async (code) => {
      const res = await safely(api.POST('/api/sandbox', { body: { code } }))
      if (!res?.data) {
        const status = res?.response.status
        if (status === 404) return '테스트판이 열려 있지 않아요'
        return status === 400 ? '코드가 맞지 않아요' : '연결이 끊겼어요. 다시 시도해 주세요'
      }
      set({ company: res.data, error: null })
      return null
    },
    leaveSandbox: async () => {
      await safely(api.DELETE('/api/sandbox'))
      await get().load()
    },
    jumpSandboxWall: (wall) => change(api.POST('/api/sandbox/wall', { body: { wall } })),
    resetSandbox: () => change(api.POST('/api/sandbox/reset')),
    setSandboxWallet: (infinite) => change(api.POST('/api/sandbox/wallet', { body: { infinite } })),
    grantSandboxCats: (level) => change(api.POST('/api/sandbox/cats', { body: { level } })),
    grantSandboxWeapon: (grade) => change(api.POST('/api/sandbox/weapon', { body: { grade } })),
    useActive: async (code) => {
      const res = await safely(api.POST('/api/company/idle/active', { body: { code } }))
      if (!res?.data) return false
      set({ company: res.data })
      return true
    },
    drawCat: async (count = 1) => {
      const res = await safely(api.POST('/api/company/cat/draw', { body: { count } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },

    fieldCat: (code, fielded) =>
      change(api.POST('/api/company/cat/field', { body: { code, fielded } })),

    equipCat: (code, weapon) =>
      change(api.POST('/api/company/cat/weapon', { body: { code, ...weapon } })),

    convene: async () => {
      // 정하지 않은 회의가 열려 있으면 그 회의다. 정한 회의는 결과로 남아 있을 뿐이라 새로 연다.
      const open = () => {
        const invest = get().company?.invest
        return Boolean(invest?.convened && !invest.outcome)
      }
      if (open()) {
        return true
      }
      await change(api.POST('/api/company/invest/open'))
      return !get().error && open()
    },

    decideInvest: (choice, big = false) =>
      change(
        api.POST('/api/company/invest', {
          body: { choice: choice as 'BUY' | 'SELL', big },
        }),
      ),

    place: (seats) => change(api.POST('/api/company/placement', { body: { seats } })),

    appointLeader: (desk, employeeId) =>
      change(api.POST('/api/company/leader', { body: { desk, employeeId } })),
  }
})
