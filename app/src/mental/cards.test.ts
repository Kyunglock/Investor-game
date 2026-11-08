import { describe, expect, it } from 'vitest'
import {
  applyCard,
  BASE_LOADOUT,
  bulletStats,
  loadoutOf,
  MAGICS,
  MAX_BULLET_POWER,
  magicCard,
  magicEffect,
  magicGrade,
  pickCards,
  SIMPLE_CARDS,
  xpToNext,
} from './cards'
import { MAGIC_MAX_LEVEL } from './magic'

function rng(seed: number) {
  let x = seed + 1
  return () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
}

describe('멘탈 카드 (decisions.md 328·330·377·392번)', () => {
  it('석 장은 서로 다른 카드이고, 마법 카드는 지금 레벨의 다음 레벨을 낸다', () => {
    const levels = { water: 2, fire: 0, lightning: 4 }
    let magics = 0
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickCards(levels, rng(seed))
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((c) => c.code)).size).toBe(3)
      for (const c of picked) {
        if (c.code === 'atk' || c.code === 'spd') {
          expect(SIMPLE_CARDS).toContainEqual(c)
          continue
        }
        magics++
        expect(c.level).toEqual({ from: levels[c.code], to: levels[c.code] + 1 })
        expect(c).toEqual(magicCard(c.code, levels[c.code]))
      }
    }
    expect(magics).toBeGreaterThan(0)
  })

  it('최대 레벨인 마법은 더 나오지 않는다', () => {
    const levels = { water: MAGIC_MAX_LEVEL, fire: MAGIC_MAX_LEVEL, lightning: 1 }
    for (let seed = 0; seed < 50; seed++) {
      for (const c of pickCards(levels, rng(seed))) {
        expect(['water', 'fire']).not.toContain(c.code)
      }
    }
  })

  it('일반 카드는 공격력·공격 속도 +10%, 마법은 등급과 상관없이 고를 때마다 한 레벨씩 오른다', () => {
    const [atk, spd] = SIMPLE_CARDS
    expect(applyCard(BASE_LOADOUT, atk).damage).toBeCloseTo(1.1)
    expect(applyCard(BASE_LOADOUT, spd).fireMs).toBeCloseTo(260 / 1.1)
    let loadout = BASE_LOADOUT
    for (let i = 0; i < MAGIC_MAX_LEVEL + 2; i++) {
      loadout = applyCard(loadout, magicCard('fire', loadout.fire))
      expect(loadout.fire).toBe(Math.min(MAGIC_MAX_LEVEL, i + 1))
    }
    expect(loadout.water).toBe(0)
  })

  it('마법 카드의 등급은 오르는 레벨을 보인다: Lv.1 희귀, Lv.2 영웅, Lv.3부터 전설', () => {
    expect(magicCard('water', 0)).toMatchObject({ grade: 'R', level: { from: 0, to: 1 } })
    expect(magicCard('water', 1).grade).toBe('SR')
    expect(magicCard('water', 2).grade).toBe('UR')
    expect(magicGrade(5)).toBe('UR')
  })

  it('카드 문구는 레벨마다 연출 이름과 수치가 바뀐다', () => {
    expect(magicEffect('water', 1)).toContain('물방울')
    expect(magicEffect('water', 2)).toContain('물줄기')
    expect(magicEffect('water', 3)).toContain('큰 물결')
    expect(magicEffect('fire', 1)).toContain('불씨')
    expect(magicEffect('fire', 3)).toContain('불기둥')
    expect(magicEffect('lightning', 3)).toContain('갈래 번개')
    expect(magicEffect('lightning', 4)).toContain('2줄기')
    for (const m of MAGICS) {
      expect(magicEffect(m, 1)).not.toBe(magicEffect(m, 2))
    }
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
    ])
    expect(upgraded.damage).toBeCloseTo(plain.damage * 1.5)
    expect(upgraded.fireMs).toBeCloseTo(160)
    expect(upgraded.moveSpeed).toBe(plain.moveSpeed)
  })

  it('연사 강화는 끝없이 올라도 간격이 0이나 음수가 되지 않는다 (394번)', () => {
    const weapon = { damagePercent: 100, fireMs: 200, power: 0, bulletSpeed: 720 }
    expect(loadoutOf(weapon, [{ kind: 'fire', bonusPercent: 100 }]).fireMs).toBeCloseTo(100)
    expect(loadoutOf(weapon, [{ kind: 'fire', bonusPercent: 1000 }]).fireMs).toBe(60)
  })

  it('다음 레벨까지 드는 경험치는 레벨이 오를수록 커진다', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(5)).toBeLessThan(xpToNext(6))
  })
})
