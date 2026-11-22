import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { nextAutoBuy } from './autoUpgrade'
import { idleLoadout } from './loadout'
import { bossMarks, catDps, fieldSteps, partyOf, recommendParty } from './party'
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
    rivals: [{ code: 'sky', name: 'sky', grade: 'C' }],
    rivalPercent: 300,
    seconds: 60,
    ...over,
  }) as Vault['boss']
const vault = (b = boss()) => ({ trainingPercent: 0, boss: b }) as unknown as Vault

describe('파티 (654번)', () => {
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

  it('보스전 추천은 약점 스킬과 천적의 배율을 넣고 내성 스킬은 낮게 본다', () => {
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
    // 같은 고양이라도 약점 스킬은 세 배로, 내성 스킬은 절반으로 센다.
    const water = catDps(c, 'mint', vs)
    const meteorPlain = catDps(c, 'lilac')
    const meteorBoss = catDps(c, 'lilac', vs)
    expect(meteorBoss).toBeLessThan(meteorPlain)
    expect(water).toBeGreaterThan(catDps(c, 'mint'))
    // 천적(sky)의 총은 세 배라 공격력이 높은 night보다 낫다.
    expect(catDps(c, 'sky', vs)).toBeGreaterThan(catDps(c, 'night', vs))
    expect(recommendParty(c, vs)).toContain('sky')
    expect(recommendParty(c, vs)).not.toContain('lilac')
  })

  it('고양이마다 약점·내성·천적을 표시한다', () => {
    const b = boss()
    expect(bossMarks({ code: 'sky', skills: [] }, b)).toEqual(['rival'])
    expect(bossMarks({ code: 'mint', skills: [{ code: 'water', name: '' }] }, b)).toEqual(['weak'])
    expect(
      bossMarks(
        {
          code: 'sky',
          skills: [
            { code: 'water', name: '' },
            { code: 'meteor', name: '' },
          ],
        },
        b,
      ),
    ).toEqual(['weak', 'resist', 'rival'])
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

  it('한 번에 100단계까지만 산다', () => {
    expect(nextAutoBuy(ups, 1e9, ['fire'])).toEqual({ kind: 'fire', levels: 100 })
  })
})
