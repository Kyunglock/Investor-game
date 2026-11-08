import { describe, expect, it } from 'vitest'
import {
  applyCard,
  BASE_LOADOUT,
  bulletStats,
  CARDS,
  loadoutOf,
  MAX_BULLET_POWER,
  pickCards,
  xpToNext,
} from './cards'

function rng(seed: number) {
  let x = seed + 1
  return () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
}

describe('멘탈 카드 (decisions.md 328·330번)', () => {
  it('석 장은 서로 다르고 카드 목록에서 나온다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickCards(BASE_LOADOUT, false, rng(seed))
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((c) => c.code)).size).toBe(3)
      for (const c of picked) {
        expect(CARDS).toContain(c)
      }
    }
  })

  it('처음(멘탈이 꽉 참)에는 심호흡이 안 나오고, 총알 강화가 최대면 강화 카드가 안 나온다', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(pickCards(BASE_LOADOUT, true, rng(seed)).map((c) => c.code)).not.toContain('heal')
      const full = { ...BASE_LOADOUT, bulletPower: MAX_BULLET_POWER }
      expect(pickCards(full, false, rng(seed)).map((c) => c.code)).not.toContain('split')
    }
  })

  it('카드는 쌓인다', () => {
    let l = BASE_LOADOUT
    l = applyCard(l, 'hold')
    l = applyCard(l, 'hold')
    expect(l.damage).toBeCloseTo(2.2)
    l = applyCard(l, 'split')
    l = applyCard(l, 'split')
    l = applyCard(l, 'split')
    expect(l.bulletPower).toBe(MAX_BULLET_POWER)
    expect(applyCard(l, 'rule').fireMs).toBeLessThan(l.fireMs)
    expect(applyCard(l, 'steel').maxMental).toBe(150)
    expect(applyCard(l, 'steel').heal).toBe(50)
    expect(applyCard(l, 'calm').bulletSpeed).toBeGreaterThan(l.bulletSpeed)
    expect(applyCard(l, 'heal').heal).toBe(40)
  })

  it('강화탄은 공격력과 크기가 함께 커지고 최대 단계에서 멈춘다', () => {
    let loadout = BASE_LOADOUT
    for (let i = 0; i < 5; i++) loadout = applyCard(loadout, 'split')
    expect(bulletStats(loadout).damage).toBeCloseTo(2.2)
    expect(bulletStats(loadout).scale).toBeCloseTo(1.6)
    expect(bulletStats(applyCard(loadout, 'hold')).damage).toBeGreaterThan(
      bulletStats(loadout).damage,
    )
  })

  it('기존 무기의 추가 탄 갈래를 강화 단계로 바꾼다', () => {
    const loadout = loadoutOf({ damagePercent: 120, fireMs: 240, streams: 3, bulletSpeed: 720 })
    expect(loadout.bulletPower).toBe(2)
    expect(bulletStats(loadout).damage).toBeCloseTo(2.16)
  })

  it('다음 레벨까지 드는 경험치는 레벨이 오를수록 커진다', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(5)).toBeLessThan(xpToNext(6))
  })
})
