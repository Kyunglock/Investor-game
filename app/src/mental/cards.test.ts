import { describe, expect, it } from 'vitest'
import {
  applyCard,
  BASE_LOADOUT,
  bulletStats,
  burnPerSecond,
  CARDS,
  chainOf,
  loadoutOf,
  MAX_BULLET_POWER,
  magicCard,
  pickCards,
  rollGrade,
  SIMPLE_CARDS,
  waterSlow,
  xpToNext,
} from './cards'

function rng(seed: number) {
  let x = seed + 1
  return () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
}

describe('멘탈 카드 (decisions.md 328·330·377번)', () => {
  it('석 장은 서로 다르고 카드 목록에서 나온다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickCards(rng(seed))
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((c) => `${c.code}-${c.grade}`)).size).toBe(3)
      for (const c of picked) {
        expect(CARDS).toContainEqual(c)
      }
    }
  })

  it('일반 카드는 공격력·공격 속도 +10%, 마법은 등급이 높을수록 단계가 높다', () => {
    const [atk, spd] = SIMPLE_CARDS
    expect(applyCard(BASE_LOADOUT, atk).damage).toBeCloseTo(1.1)
    expect(applyCard(BASE_LOADOUT, spd).fireMs).toBeCloseTo(260 / 1.1)
    expect(applyCard(BASE_LOADOUT, magicCard('fire', 'R')).fire).toBe(1)
    expect(applyCard(BASE_LOADOUT, magicCard('fire', 'UR')).fire).toBe(3)
    // 같은 마법은 쌓인다.
    const twice = applyCard(
      applyCard(BASE_LOADOUT, magicCard('water', 'R')),
      magicCard('water', 'SR'),
    )
    expect(twice.water).toBe(3)
  })

  it('등급은 일반이 가장 흔하고 전설이 가장 드물다', () => {
    const count = { N: 0, R: 0, SR: 0, UR: 0 }
    const r = rng(7)
    for (let i = 0; i < 4000; i++) count[rollGrade(r)]++
    expect(count.N).toBeGreaterThan(count.R)
    expect(count.R).toBeGreaterThan(count.SR)
    expect(count.SR).toBeGreaterThan(count.UR)
    expect(count.UR).toBeGreaterThan(0)
  })

  it('마법 세기: 물은 단계마다 더 느리게(최대 70%), 불은 피해 비례, 번개는 단계만큼 튄다', () => {
    expect(waterSlow(1).factor).toBeCloseTo(0.8)
    expect(waterSlow(9).factor).toBeCloseTo(0.3)
    expect(burnPerSecond(2, 2)).toBeCloseTo(1.2)
    expect(chainOf(2, 3)).toEqual({ targets: 3, damage: 1.2 })
  })

  it('강화탄은 공격력과 크기가 함께 커지고 최대 단계에서 멈춘다', () => {
    let loadout = BASE_LOADOUT
    for (let i = 0; i < 5; i++)
      loadout = { ...loadout, bulletPower: Math.min(MAX_BULLET_POWER, loadout.bulletPower + 1) }
    expect(bulletStats(loadout).damage).toBeCloseTo(2.2)
    expect(bulletStats(loadout).scale).toBeCloseTo(1.6)
    expect(bulletStats(applyCard(loadout, SIMPLE_CARDS[0])).damage).toBeGreaterThan(
      bulletStats(loadout).damage,
    )
  })

  it('무기가 가진 강화 단계에서 시작한다', () => {
    const loadout = loadoutOf({ damagePercent: 120, fireMs: 240, power: 2, bulletSpeed: 720 })
    expect(loadout.bulletPower).toBe(2)
    expect(bulletStats(loadout).damage).toBeCloseTo(2.16)
  })

  it('범위 피해는 강화 2단계부터 붙고 단계가 오를수록 넓어진다', () => {
    const at = (bulletPower: number) => bulletStats({ ...BASE_LOADOUT, bulletPower })
    expect(at(0).splashRadius).toBe(0)
    expect(at(1).splashRadius).toBe(0)
    expect(at(1).splashDamage).toBe(0)
    expect(at(2).splashRadius).toBeGreaterThan(0)
    expect(at(3).splashRadius).toBeGreaterThan(at(2).splashRadius)
    expect(at(2).splashDamage).toBeCloseTo(at(2).damage * 0.5)
  })

  it('자본으로 산 전투 강화가 무기 위에 붙는다', () => {
    const weapon = { damagePercent: 100, fireMs: 200, power: 0, bulletSpeed: 720 }
    const plain = loadoutOf(weapon)
    const upgraded = loadoutOf(weapon, [
      { kind: 'damage', bonusPercent: 50 },
      { kind: 'fire', bonusPercent: 25 },
      { kind: 'speed', bonusPercent: 40 },
    ])
    expect(upgraded.damage).toBeCloseTo(plain.damage * 1.5)
    expect(upgraded.fireMs).toBeCloseTo(150)
    expect(upgraded.moveSpeed).toBeCloseTo(plain.moveSpeed * 1.4)
  })

  it('다음 레벨까지 드는 경험치는 레벨이 오를수록 커진다', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(5)).toBeLessThan(xpToNext(6))
  })
})
