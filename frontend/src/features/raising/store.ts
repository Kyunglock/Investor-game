import { create } from 'zustand'
import { api, type Company, setSandboxCode } from '../../api/client'

type Status = 'loading' | 'ready' | 'error'

export type WeaponKind = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle'
export type WeaponGrade = NonNullable<Company['weapons']>[number]['grade']
export type ActiveCode = NonNullable<NonNullable<Company['idle']>['actives']>[number]['code']
/** 장착하는 고유 스킬 (decisions.md 587번). 광고 스킬(588번)은 장착하지 않는다. */
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
  tab: 'meeting' | 'market' | null
  load: () => Promise<void>
  /** 사장의 사재로 첫 회사를 차린다 (decisions.md 228번). */
  open: () => Promise<void>
  /** 다이아로 count명을 뽑는다 (decisions.md 312·526번). 뽑힌 직원은 서버가 바로 자리에 앉힌다 (#801). */
  draw: (count: number) => Promise<void>
  /** 이사 비용을 내고 다음 건물로 간다 (decisions.md 296번). */
  upgrade: () => Promise<void>
  /** 가진 무기 가운데 하나를 든다 (decisions.md 346번). */
  equipWeapon: (kind: WeaponKind, grade: WeaponGrade) => Promise<void>
  /** 사장냥이 든 무기를 뺀다 (decisions.md 585번): 기본 권총을 쏜다. */
  unequipWeapon: () => Promise<void>
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
    kind: 'damage' | 'fire' | 'hp' | 'buy',
    levels?: number,
  ) => Promise<Company | null>
  /** 무기를 뽑는다. ad는 보상형 광고를 끝까지 본 경우다. count(1~10)가 2 이상이면 연속 뽑기(639·640번)로 company.armory.lastDraws에 담긴다. */
  drawWeapon: (ad?: boolean, count?: number) => Promise<void>
  /** 같은 무기 여럿을 합쳐 한 등급 올린다 (decisions.md 366번). */
  mergeAllWeapons: () => Promise<void>
  mergeWeapon: (kind: WeaponKind, grade: Exclude<WeaponGrade, 'LR'>) => Promise<void>
  /** 고양이를 뽑는다. ad는 보상형 광고를 끝까지 본 경우다. count(1~10)가 2 이상이면 연속 뽑기(639·640번)로 company.idle.lastDraws에 담긴다. */
  drawCat: (ad?: boolean, count?: number) => Promise<Company | null>
  /** 액티브 스킬을 쓴다 (decisions.md 503번). 서버가 받아 줬으면 true. 전투를 멈추지 않게 busy를 켜지 않는다. */
  /** ad: 광고를 끝까지 본 뒤에 쓴다 (588번). 광고 스킬은 ad가 참이어야 서버가 받아 준다. */
  useActive: (code: ActiveCode, ad?: boolean) => Promise<boolean>
  /** 고유 스킬을 장착하거나 뺀다 (decisions.md 587번). 세 개까지. */
  tutorial: (
    action: 'next' | 'draw-cat' | 'draw-weapon' | 'start' | 'skills',
    step: number,
  ) => Promise<void>
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
  /** 테스트판: 동료 고양이 45종을 모두 그 레벨로 받는다. */
  grantSandboxCats: (level: number) => Promise<void>
  /** 테스트판: 그 등급의 무기를 받아 사장냥이 든다. */
  grantSandboxWeapon: (grade: WeaponGrade) => Promise<void>
  /** 테스트판: 하루가 지난 셈 친다. 출석 보상을 다시 받을 수 있다 (528번). */
  skipSandboxDay: () => Promise<void>
  /**
   * 오늘의 출석 보상을 받는다 (decisions.md 528번). 받은 것은 company.attendance.lastReward. 받은 회사(오늘 이미 받았거나 끊겼으면 null)를
   * 돌려준다. 전투를 멈추지 않게 busy를 켜지 않는다.
   */
  claimAttendance: () => Promise<Company | null>
  /**
   * 상점에서 상품 하나를 산다 (decisions.md 541번). 산 것은 company.shop.lastReceipt. 산 회사(거절되거나 끊겼으면 null)를 돌려준다.
   * 전투를 멈추지 않게 busy를 켜지 않는다.
   */
  buyShopItem: (code: string) => Promise<Company | null>
  /**
   * 금고 도전 (decisions.md 641번): 보스전의 피해량을 알리고, 던전의 층을 깼다고 알리고, 다음 층의 카드를 고르고, 금괴로 금고 상점의 상품을
   * 산다. 받은 것은 company.vault.lastNote. 바뀐 회사(거절되거나 끊겼으면 null)를 돌려준다. 전투를 멈추지 않게 busy를 켜지 않는다.
   */
  /** cats: 데려간 파티(654번). 없으면 지금 출전한 팀으로 상한을 잰다. */
  reportVaultBoss: (damage: number, cats?: string[]) => Promise<Company | null>
  clearVaultFloor: (floor: number) => Promise<Company | null>
  pickVaultCard: (code: string) => Promise<Company | null>
  buyVaultItem: (code: string) => Promise<Company | null>
  /**
   * 시즌패스의 단계 보상을 받는다 (decisions.md 529번). step을 주면 그 단계 하나, 없으면 받을 수 있는 것을 모두 받는다. 받은 것은
   * company.pass.lastRewards. 받은 회사(거절되거나 끊겼으면 null)를 돌려준다. 전투를 멈추지 않게 busy를 켜지 않는다.
   */
  claimPass: (step?: number) => Promise<Company | null>
  /**
   * 시즌패스 미션의 포인트를 받는다 (572번). code가 없으면 받을 수 있는 것을 모두 받는다. 받은 회사(거절되거나 끊겼으면 null)를 돌려준다.
   */
  claimPassMission: (code?: string) => Promise<Company | null>
  /** 테스트판: 시즌패스 경험치를 더한다 (529번). */
  addSandboxPassExp: (exp: number) => Promise<void>
  /** 테스트판: 다음 시즌으로 넘긴다. 진행도가 비워진다 (529번). */
  skipSandboxSeason: () => Promise<void>
  sellBread: () => Promise<void>
  /** 가진 고양이를 출전시키거나 쉬게 한다 (488번). */
  /** slot: 세울 출전 칸의 번호(0부터, 599번). */
  fieldCat: (code: CatCode, fielded: boolean, replaceCode?: CatCode, slot?: number) => Promise<void>
  /** 사장냥을 쉬게 하거나 다시 내보낸다 (672번). 출전한 고양이가 있을 때만 쉴 수 있다. */
  fieldBoss: (fielded: boolean) => Promise<void>
  /** 생선으로 가진 고양이의 레벨을 하나 올린다 (decisions.md 571번). */
  /** 생선으로 영구 강화를 levels단계까지(없으면 한 단계) 올린다 (600·663번). */
  buyFishUpgrade: (kind: 'damage' | 'hp' | 'buy', levels?: number) => Promise<void>
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

    unequipWeapon: () => change(api.POST('/api/company/weapon', { body: {} })),

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

    drawWeapon: (ad = false, count = 1) =>
      change(api.POST('/api/company/weapon/draw', { body: { count, ad } })),

    mergeAllWeapons: () => change(api.POST('/api/company/weapon/merge-all')),
    mergeWeapon: (kind, grade) =>
      change(api.POST('/api/company/weapon/merge', { body: { kind, grade } })),

    enterSandbox: async (code) => {
      const res = await safely(api.POST('/api/sandbox', { body: { code } }))
      if (!res?.data) {
        const status = res?.response.status
        if (status === 404) return '테스트판이 열려 있지 않아요'
        return status === 400 ? '코드가 맞지 않아요' : '연결이 끊겼어요. 다시 시도해 주세요'
      }
      // 이 뒤의 요청부터 코드를 머리글로 싣는다: 테스트판 쿠키가 남지 않는 앱에서도 테스트판이 이어진다.
      setSandboxCode(code)
      set({ company: res.data, error: null })
      return null
    },
    leaveSandbox: async () => {
      setSandboxCode(null)
      await safely(api.DELETE('/api/sandbox'))
      await get().load()
    },
    jumpSandboxWall: (wall) => change(api.POST('/api/sandbox/wall', { body: { wall } })),
    resetSandbox: () => change(api.POST('/api/sandbox/reset')),
    setSandboxWallet: (infinite) => change(api.POST('/api/sandbox/wallet', { body: { infinite } })),
    grantSandboxCats: (level) => change(api.POST('/api/sandbox/cats', { body: { level } })),
    grantSandboxWeapon: (grade) => change(api.POST('/api/sandbox/weapon', { body: { grade } })),
    skipSandboxDay: () => change(api.POST('/api/sandbox/next-day')),
    claimAttendance: async () => {
      const res = await safely(api.POST('/api/company/attendance'))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    buyShopItem: async (code) => {
      const res = await safely(api.POST('/api/company/shop/{code}', { params: { path: { code } } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    reportVaultBoss: async (damage, cats) => {
      const res = await safely(
        api.POST('/api/company/vault/boss', { body: cats ? { damage, cats } : { damage } }),
      )
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    clearVaultFloor: async (floor) => {
      const res = await safely(api.POST('/api/company/vault/floor', { body: { floor } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    pickVaultCard: async (code) => {
      const res = await safely(api.POST('/api/company/vault/card', { body: { code } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    buyVaultItem: async (code) => {
      const res = await safely(
        api.POST('/api/company/vault/shop/{code}', { params: { path: { code } } }),
      )
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    claimPass: async (step) => {
      const res = await safely(
        api.POST('/api/company/pass/claim', { body: step == null ? {} : { step } }),
      )
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    claimPassMission: async (code) => {
      const res = await safely(
        api.POST('/api/company/pass/missions/claim', { body: code == null ? {} : { code } }),
      )
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },
    addSandboxPassExp: (exp) => change(api.POST('/api/sandbox/pass-exp', { body: { exp } })),
    skipSandboxSeason: () => change(api.POST('/api/sandbox/next-season')),
    useActive: async (code, ad) => {
      const res = await safely(
        api.POST('/api/company/idle/active', { body: ad ? { code, ad } : { code } }),
      )
      if (!res?.data) return false
      set({ company: res.data })
      return true
    },
    tutorial: (action, step) =>
      change(api.POST('/api/company/idle/tutorial', { body: { action, step } })),
    drawCat: async (ad = false, count = 1) => {
      const res = await safely(api.POST('/api/company/cat/draw', { body: { count, ad } }))
      set({ company: res?.data ?? get().company, error: reason(res?.error) })
      return res?.data ?? null
    },

    sellBread: () => change(api.POST('/api/company/bread/sell')),

    fieldCat: (code, fielded, replaceCode, slot) =>
      change(api.POST('/api/company/cat/field', { body: { code, fielded, replaceCode, slot } })),

    fieldBoss: (fielded) => change(api.POST('/api/company/boss/field', { body: { fielded } })),

    buyFishUpgrade: (kind, levels = 1) =>
      change(api.POST('/api/company/rebirth/upgrade', { body: { kind, levels } })),

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
  }
})
