import { describe, expect, it } from 'vitest'
import {
  aimWithJitter,
  BASE_CRIT_CHANCE,
  BASE_CRIT_MULT,
  CRIT_MULT,
  FIRE_STYLES,
  pierceOf,
  RIFLE_PIERCE,
  WEAPON_EFFECTS,
  WEAPON_TRAITS,
  weaponDamage,
} from './weaponEffects'

describe('무기마다 다른 효과 (decisions.md 376번)', () => {
  it('다섯 무기가 저마다 다른 효과 이름을 가진다', () => {
    const names = Object.values(WEAPON_EFFECTS).map((e) => e.name)
    expect(new Set(names).size).toBe(5)
  })

  it('리볼버만 치명타가 터진다', () => {
    expect(weaponDamage('revolver', 2, 0.1)).toEqual({ damage: 2 * CRIT_MULT, crit: true })
    expect(weaponDamage('revolver', 2, 0.9)).toEqual({ damage: 2, crit: false })
    expect(weaponDamage('pistol', 2, 0.2)).toEqual({ damage: 2, crit: false })
    // 다른 무기도 10%로 두 배, 치명타 피해 강화는 배율에 곱한다 (487번).
    expect(weaponDamage('pistol', 2, 0.05)).toEqual({ damage: 2 * BASE_CRIT_MULT, crit: true })
    expect(weaponDamage('pistol', 2, BASE_CRIT_CHANCE).crit).toBe(false)
    expect(weaponDamage('revolver', 2, 0.1, 0.5).damage).toBe(2 * CRIT_MULT * 1.5)
    expect(weaponDamage('revolver', 2, 0.9, 0.5).damage).toBe(2)
  })

  it('소총만 여러 적을 뚫는다', () => {
    expect(pierceOf('rifle')).toBe(RIFLE_PIERCE)
    expect(pierceOf('smg')).toBe(1)
  })
})

describe('무기마다 쏘는 방식 (#563)', () => {
  it('다섯 무기의 탄 모양·빛·반동이 모두 다르다', () => {
    const looks = Object.values(FIRE_STYLES).map(
      (s) => `${s.length}/${s.width}/${s.tint}/${s.recoil}`,
    )
    expect(new Set(looks).size).toBe(5)
  })

  it('기관단총만 흩어지고, 그 폭 안에 든다', () => {
    expect(aimWithJitter('pistol', 1, 0)).toBe(1)
    expect(aimWithJitter('rifle', 1, 1)).toBe(1)
    const j = FIRE_STYLES.smg.jitter
    expect(aimWithJitter('smg', 1, 0)).toBeCloseTo(1 - j)
    expect(aimWithJitter('smg', 1, 1)).toBeCloseTo(1 + j)
  })

  it('소총은 가장 길고 가는 탄, 산탄총은 가장 굵은 탄', () => {
    const s = Object.values(FIRE_STYLES)
    expect(FIRE_STYLES.rifle.length).toBe(Math.max(...s.map((x) => x.length)))
    expect(FIRE_STYLES.shotgun.width).toBe(Math.max(...s.map((x) => x.width)))
  })
})

describe('무기마다 극명한 강점과 약점 (#587, decisions.md 430번)', () => {
  it('다섯 무기의 강점·약점이 모두 다르다', () => {
    const t = Object.values(WEAPON_TRAITS)
    expect(new Set(t.map((x) => x.strength)).size).toBe(5)
    expect(new Set(t.map((x) => x.weakness)).size).toBe(5)
  })

  it('기관단총·산탄총만 사거리가 짧고(산탄총이 더 짧다), 리볼버만 재장전, 산탄총만 밀어낸다', () => {
    expect(WEAPON_TRAITS.pistol.range).toBeNull()
    expect(WEAPON_TRAITS.rifle.range).toBeNull()
    expect(WEAPON_TRAITS.shotgun.range).toBeLessThan(WEAPON_TRAITS.smg.range ?? 1)
    expect(
      Object.entries(WEAPON_TRAITS)
        .filter(([, x]) => x.magazine)
        .map(([k]) => k),
    ).toEqual(['revolver'])
    expect(
      Object.entries(WEAPON_TRAITS)
        .filter(([, x]) => x.knockback > 0)
        .map(([k]) => k),
    ).toEqual(['shotgun'])
  })

  it('리볼버 치명타는 40%·세 배, 소총은 넷까지 뚫는다', () => {
    expect(weaponDamage('revolver', 2, 0.39).crit).toBe(true)
    expect(weaponDamage('revolver', 2, 0.41).crit).toBe(false)
    expect(CRIT_MULT).toBe(3)
    expect(RIFLE_PIERCE).toBe(4)
  })
})
