import { describe, expect, it } from 'vitest'
import {
  aimWithJitter,
  CRIT_MULT,
  FIRE_STYLES,
  pierceOf,
  RIFLE_PIERCE,
  WEAPON_EFFECTS,
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
    expect(weaponDamage('pistol', 2, 0.1)).toEqual({ damage: 2, crit: false })
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
