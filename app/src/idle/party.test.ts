import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { autoBuyPlan, nextAutoBuy } from './autoUpgrade'
import { idleLoadout } from './loadout'
import { catDps, fieldSteps, partyDps, partyOf, recommendParty } from './party'
import type { Vault } from './vaultBattle'

type Cat = {
  code: string
  fielded: boolean
  level?: number
  slot?: number
  skills?: string[]
  damagePercent?: number
}

const company = (cats: Cat[], slots = 2) =>
  ({
    companyId: 'c1',
    idle: {
      fieldSlots: slots,
      cats: cats.map((cat) => ({
        level: 1,
        name: cat.code,
        grade: 'C',
        skillLevel: 1,
        damagePercent: 50,
        firePercent: 100,
        criticalPercent: 100,
        weapon: null,
        ...cat,
        skills: (cat.skills ?? []).map((code) => ({ code, name: code })),
      })),
    },
    weapons: [
      {
        kind: 'pistol',
        grade: 'F',
        damagePercent: 100,
        fireMs: 260,
        power: 0,
        bulletSpeed: 720,
        equipped: true,
      },
    ],
    battleUpgrades: [{ kind: 'damage', bonusPercent: 0 }],
  }) as unknown as Company

const boss = (over: Partial<Vault['boss']> = {}) =>
  ({
    weakSkills: [{ code: 'water', name: '물' }],
    weakPercent: 300,
    resistSkills: [{ code: 'meteor', name: '메테오' }],
    resistPercent: 50,
    rivals: [],
    rivalPercent: 100,
    seconds: 60,
    ...over,
  }) as Vault['boss']
const vault = (b = boss()) => ({ trainingPercent: 0, boss: b }) as unknown as Vault

describe('파티 (654번)', () => {
  it.each([true, false])('금고 모드 boss=%s의 예상 DPS는 영구 강화만 반영한다', (isBoss) => {
    const c = company([{ code: 'mint', fielded: true, skills: ['water'] }])
    const vs = { vault: vault(), boss: isBoss }
    const base = partyDps(c, ['mint'], vs)
    if (!c.battleUpgrades || !c.idle) throw new Error('Missing company fixture')
    c.battleUpgrades[0].bonusPercent = 9900
    expect(partyDps(c, ['mint'], vs)).toBe(base)
    expect(partyDps(c, ['mint'])).toBeGreaterThan(base)
    c.idle.rebirth = { upgrades: [{ kind: 'damage', bonus: 100 }] } as NonNullable<
      NonNullable<Company['idle']>['rebirth']
    >
    expect(partyDps(c, ['mint'], vs)).toBeCloseTo(base * 2)
  })

  it('파티를 주면 출전 칸 대신 그 고양이들로 팀을 꾸린다', () => {
    const c = company([
      { code: 'sky', fielded: true },
      { code: 'mint', fielded: false, skills: ['water'] },
      { code: 'snow', fielded: false, level: 0 },
    ])
    expect(idleLoadout(c).mateGuns.map((g) => g.tag?.code)).toEqual(['sky'])
    // 가지지 않은 고양이(레벨 0)는 빠진다.
    expect(idleLoadout(c, ['mint', 'snow']).mateGuns.map((g) => g.tag?.code)).toEqual(['mint'])
    expect(idleLoadout(c, ['mint']).mateMagic).toEqual([['water']])
  })

  it('저장한 파티가 없으면 출전 칸, 있으면 가진 고양이만 칸 수까지', () => {
    const c = company([
      { code: 'sky', fielded: true },
      { code: 'mint', fielded: false },
      { code: 'lilac', fielded: false },
      { code: 'snow', fielded: false, level: 0 },
    ])
    expect(partyOf(c, null)).toEqual(['sky'])
    expect(partyOf(c, ['snow', 'mint', 'mint', 'lilac', 'sky'])).toEqual(['mint', 'lilac'])
  })

  it('추천은 더하는 피해가 큰 고양이부터 칸 수만큼 고른다', () => {
    const c = company([
      { code: 'sky', fielded: true, damagePercent: 50 },
      { code: 'mint', fielded: false, damagePercent: 200 },
      { code: 'lilac', fielded: false, damagePercent: 100 },
    ])
    expect(recommendParty(c)).toEqual(['mint', 'lilac'])
  })

  it('이전 약점·내성 데이터가 있어도 보스전 피해량에는 반영하지 않는다', () => {
    const c = company(
      [
        { code: 'sky', fielded: false, damagePercent: 50 },
        { code: 'mint', fielded: false, damagePercent: 50, skills: ['water'] },
        { code: 'lilac', fielded: false, damagePercent: 50, skills: ['meteor'] },
        { code: 'night', fielded: false, damagePercent: 120 },
      ],
      2,
    )
    const vs = { vault: vault(), boss: true }
    // 오래된 응답에 상성 값이 남아 있어도 무시한다.
    const water = catDps(c, 'mint', vs)
    const meteorPlain = catDps(c, 'lilac')
    const meteorBoss = catDps(c, 'lilac', vs)
    expect(meteorBoss).toBeCloseTo(meteorPlain)
    expect(water).toBeCloseTo(catDps(c, 'mint'))
    // 천적 고양이는 없다 (694번): 스킬 없는 고양이는 공격력대로다.
    expect(catDps(c, 'sky', vs)).toBeLessThan(catDps(c, 'night', vs))
    expect(catDps(c, 'sky', vs)).toBeCloseTo(catDps(c, 'sky'))
  })

  it('출전 칸을 추천으로 바꾸는 차례: 빈 칸에 세우고, 찼으면 빠질 고양이와 바꾸고, 남은 것은 뺀다', () => {
    const cats = [
      { code: 'a', fielded: true },
      { code: 'b', fielded: true },
      { code: 'c', fielded: false },
      { code: 'd', fielded: false },
    ]
    expect(fieldSteps(cats, 3, ['c', 'a'])).toEqual([
      { code: 'c', fielded: true },
      { code: 'b', fielded: false },
    ])
    expect(fieldSteps(cats, 2, ['c', 'd'])).toEqual([
      { code: 'c', fielded: true, replaceCode: 'a' },
      { code: 'd', fielded: true, replaceCode: 'b' },
    ])
    expect(fieldSteps(cats, 2, ['a', 'b'])).toEqual([])
  })
})

describe('지정 자동 강화 (654번)', () => {
  const up = (kind: string, price: number, level = 1, maxLevel = 0) => ({
    kind,
    price,
    level,
    maxLevel,
    priceGrowthPercent: 0,
  })
  const ups = [up('damage', 100), up('fire', 50), up('hp', 10, 5, 5)] as unknown as Parameters<
    typeof nextAutoBuy
  >[0]

  it('고른 것 가운데 살 수 있는 가장 싼 것을, 가진 돈만큼 산다', () => {
    expect(nextAutoBuy(ups, 1000, ['damage', 'fire'])).toEqual({ kind: 'fire', levels: 20 })
    expect(nextAutoBuy(ups, 120, ['damage'])).toEqual({ kind: 'damage', levels: 1 })
  })

  it('고르지 않았거나 끝까지 올랐거나 돈이 모자라면 사지 않는다', () => {
    expect(nextAutoBuy(ups, 1000, [])).toBeNull()
    expect(nextAutoBuy(ups, 1000, ['hp'])).toBeNull()
    expect(nextAutoBuy(ups, 40, ['damage', 'fire'])).toBeNull()
  })

  it('고른 것이 여럿이면 값이 다음으로 싼 것을 넘기 전까지만 사서 번갈아 오른다 (655번)', () => {
    const grow = (kind: string, price: number) => ({ ...up(kind, price), priceGrowthPercent: 10 })
    const two = [grow('damage', 100), grow('fire', 150)] as unknown as Parameters<
      typeof nextAutoBuy
    >[0]
    // 100 → 110 → 121 → 133 → 146까지는 150 아래다: 다섯 단계만 산다.
    expect(nextAutoBuy(two, 1e9, ['damage', 'fire'])).toEqual({ kind: 'damage', levels: 5 })
    // 하나만 골랐으면 가진 돈만큼 산다.
    expect(nextAutoBuy(two, 1e9, ['damage'])).toEqual({ kind: 'damage', levels: 100 })
    // 가장 싼 것을 살 돈이 없으면 기다린다(비싼 것으로 건너뛰지 않는다).
    expect(nextAutoBuy(two, 90, ['damage', 'fire'])).toBeNull()
  })

  it('돈이 닿는 데까지 번갈아 사서 능력치마다 한 묶음으로 보낸다 (665번)', () => {
    const grow = (kind: string, price: number) => ({ ...up(kind, price), priceGrowthPercent: 10 })
    const two = [grow('damage', 100), grow('fire', 100)] as unknown as Parameters<
      typeof nextAutoBuy
    >[0]
    // 값이 같으면 nextAutoBuy는 한 단계뿐이지만, 계획은 가진 돈을 다 쓴다: 100+100+110+110+121+121 = 662.
    expect(nextAutoBuy(two, 700, ['damage', 'fire'])).toEqual({ kind: 'damage', levels: 1 })
    expect(autoBuyPlan(two, 700, ['damage', 'fire'])).toEqual([
      { kind: 'damage', levels: 3 },
      { kind: 'fire', levels: 3 },
    ])
    // 돈이 넘쳐도 능력치마다 100단계까지다. 고르지 않은 것과 살 수 없을 때는 비어 있다.
    expect(autoBuyPlan(two, 1e300, ['damage', 'fire'])).toEqual([
      { kind: 'damage', levels: 100 },
      { kind: 'fire', levels: 100 },
    ])
    expect(autoBuyPlan(two, 99, ['damage', 'fire'])).toEqual([])
    expect(autoBuyPlan(two, 1e9, [])).toEqual([])
  })

  it('한 번에 100단계까지만 산다', () => {
    expect(nextAutoBuy(ups, 1e9, ['fire'])).toEqual({ kind: 'fire', levels: 100 })
  })
})
