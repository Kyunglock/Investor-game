import { describe, expect, it } from 'vitest'
import { CRIT_MULT, pierceOf, RIFLE_PIERCE, WEAPON_EFFECTS, weaponDamage } from './weaponEffects'

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
