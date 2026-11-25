import { describe, expect, it } from 'vitest'
import { assaultSpec } from '../mental/assault'
import { BASE_LOADOUT, type Loadout } from '../mental/cards'
import {
  bossEncounter,
  bossScale,
  bossTier,
  cardMods,
  DUNGEON_FLOW,
  dungeonEncounter,
  FLOOR_HP,
  FLOOR_WALLS,
  GUARDIAN_HP,
  leftText,
  scoreText,
  teamDps,
  teamScale,
  type Vault,
  type VaultCard,
  vaultLoadout,
} from './vaultBattle'

const card = (over: Partial<VaultCard>): VaultCard => ({
  code: 'card',
  name: '카드',
  effect: '',
  damagePercent: 100,
  firePercent: 100,
  skillPercent: 100,
  mentalPercent: 100,
  enemyHpPercent: 100,
  enemySpeedPercent: 100,
  wallHpPercent: 100,
  bossHpPercent: 100,
  ...over,
})

const gun = { ...BASE_LOADOUT, kind: 'pistol', grade: 'F', critical: 1, look: 0 } as const
const team: Loadout = {
  ...BASE_LOADOUT,
  damage: 4,
  skillDamage: 4,
  mates: 2,
  mateGuns: [
    { ...gun, damage: 2, tag: { code: 'sky', name: '하늘냥', grade: 'C' } },
    { ...gun, damage: 6, tag: { code: 'night', name: '밤냥', grade: 'A' } },
  ],
  mateMagic: [[], ['meteor']],
  mateMagicLevels: [1, 1],
}

describe('금고 도전', () => {
  it('팀 화력은 총과 스킬을 더하고, 처음 권총이 1배다', () => {
    expect(teamScale(BASE_LOADOUT)).toBe(1)
    const pistol = teamDps(BASE_LOADOUT)
    const guns = teamDps({ ...team, mateMagic: undefined })
    expect(guns).toBeCloseTo(pistol * (4 + 2 + 6))
    expect(teamDps(team)).toBeGreaterThan(guns)
    // 약한 팀도 처음 권총보다 무른 금고를 만나지는 않는다.
    expect(teamScale({ ...BASE_LOADOUT, damage: 0.1 })).toBe(1)
  })

  it('보스전은 수호냥의 벽 하나다', () => {
    expect(bossEncounter().walls.map((w) => w.boss)).toEqual([true])
  })

  it('던전은 층마다 벽이 늘고 팀 화력과 층을 따라 단단해지며 물량은 그대로다', () => {
    for (const floor of [1, 2, 3]) {
      const spec = dungeonEncounter(floor, 100, 1)
      expect(spec.walls).toHaveLength(FLOOR_WALLS[floor - 1] + 1)
      expect(spec.walls.at(-1)?.boss).toBe(true)
      expect(spec.walls.filter((w) => w.boss)).toHaveLength(1)
      const strong = dungeonEncounter(floor, 100, 10)
      expect(strong.walls[0].cellHp).toBeCloseTo(spec.walls[0].cellHp * 10)
      expect(strong.bossHp).toBeCloseTo(spec.bossHp * 10)
      // 물량의 수량은 매수벽을 깎는 양이라 팀이 세져도 그대로다.
      expect(strong.enemyHp).toBe(spec.enemyHp)
      expect(spec.enemyCount).toBeCloseTo(assaultSpec(floor).enemyCount * DUNGEON_FLOW)
      expect(spec.bossHp).toBeCloseTo(assaultSpec(floor).bossHp * FLOOR_HP[floor - 1] * GUARDIAN_HP)
    }
    const hp = (floor: number) => dungeonEncounter(floor, 100, 1).bossHp
    expect(hp(2)).toBeGreaterThan(hp(1))
    expect(hp(3)).toBeGreaterThan(hp(2))
  })

  it('카드는 서로 곱해지고 벽·물량·수호냥을 깎는다', () => {
    const cards = [
      card({ damagePercent: 125 }),
      card({ damagePercent: 160, mentalPercent: 60 }),
      card({ wallHpPercent: 80, bossHpPercent: 65, enemyHpPercent: 65, enemySpeedPercent: 75 }),
    ]
    const mods = cardMods(cards)
    expect(mods.damage).toBeCloseTo(2)
    expect(mods.mental).toBeCloseTo(0.6)
    const plain = dungeonEncounter(2, 7, 5)
    const eased = dungeonEncounter(2, 7, 5, cards)
    expect(eased.walls[0].cellHp).toBeCloseTo(plain.walls[0].cellHp * 0.8)
    expect(eased.bossHp).toBeCloseTo(plain.bossHp * 0.65)
    expect(eased.enemyHp).toBeCloseTo(plain.enemyHp * 0.65)
    expect(eased.enemySpeed).toBeCloseTo(plain.enemySpeed * 0.75)
  })

  it('금고 팀은 배율을 총·스킬·멘탈에 붙이고 천적 고양이의 총만 더 세다', () => {
    const tuned = vaultLoadout(team, { damage: 2, fire: 2, skill: 1.5, mental: 0.5 }, ['sky'], 3)
    expect(tuned.damage).toBe(8)
    expect(tuned.fireMs).toBe(BASE_LOADOUT.fireMs / 2)
    expect(tuned.skillDamage).toBe(12)
    expect(tuned.maxMental).toBe(50)
    expect(tuned.mateGuns.map((g) => g.damage)).toEqual([12, 12])
    expect(tuned.mateGuns[0].fireMs).toBe(BASE_LOADOUT.fireMs / 2)
    // 연사 간격의 바닥(60ms)은 그대로다.
    expect(vaultLoadout(team, { fire: 100 }).fireMs).toBe(60)
    expect(team.damage).toBe(4)
  })

  it('약점과 내성은 그 스킬의 피해에만 붙고 번개의 튄 피해와 충차의 들이받기도 따른다', () => {
    const scale = bossScale({
      weakSkills: [
        { code: 'bolt', name: '번개' },
        { code: 'fire', name: '불' },
      ],
      resistSkills: [
        { code: 'ram', name: '충차' },
        { code: 'ice', name: '얼음' },
      ],
      weakPercent: 200,
      resistPercent: 50,
    } as Vault['boss'])
    expect(scale('lightning')).toBe(2)
    expect(scale('chain')).toBe(2)
    expect(scale('fire')).toBe(2)
    expect(scale('earth')).toBe(0.5)
    expect(scale('siege')).toBe(0.5)
    expect(scale('ice')).toBe(0.5)
    expect(scale('bullet')).toBe(1)
    expect(scale('crit')).toBe(1)
    expect(scale('water')).toBe(1)
  })

  it('피해량은 10배로 적고 만 단위로 끊는다', () => {
    expect(scoreText(0)).toBe('0')
    expect(scoreText(12.34)).toBe('123')
    expect(scoreText(999.9)).toBe('9,999')
    expect(scoreText(1_234)).toBe('1.2만')
    expect(scoreText(123_456)).toBe('123만')
    expect(scoreText(98_765_432_1)).toBe('98.7억')
    expect(scoreText(1e15)).toBe('1경')
  })

  it('남은 시간은 큰 단위 둘로 적는다', () => {
    expect(leftText(3 * 86_400_000 + 4 * 3_600_000)).toBe('3일 4시간')
    expect(leftText(5 * 3_600_000 + 12 * 60_000)).toBe('5시간 12분')
    expect(leftText(8 * 60_000)).toBe('8분')
    expect(leftText(-5)).toBe('0분')
  })
})

describe('보스전 등급 게이지 (692번)', () => {
  it('문턱은 10에서 1.5배씩이고 이름은 서버와 같다', () => {
    expect(bossTier(0)).toEqual({ tier: 0, name: '등급 없음', fill: 0 })
    expect(bossTier(5).fill).toBeCloseTo(0.5)
    expect(bossTier(10)).toMatchObject({ tier: 1, name: '브론즈 1', fill: 0 })
    expect(bossTier(15)).toMatchObject({ tier: 2, name: '브론즈 2' })
    expect(bossTier(12.5).fill).toBeCloseTo(0.5)
    expect(bossTier(10 * 1.5 ** 10).name).toBe('실버 1')
    expect(bossTier(10 * 1.5 ** 64.5).name).toBe('마스터 15')
  })
})
