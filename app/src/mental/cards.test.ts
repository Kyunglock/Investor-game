import { describe, expect, it } from 'vitest'
import { CARDS, loadoutOf, pickCards } from './cards'

describe('멘탈 카드 (decisions.md 328번)', () => {
  it('석 장은 서로 다르고 다섯 가운데서 나온다', () => {
    for (let seed = 0; seed < 50; seed++) {
      let x = seed + 1
      const random = () => {
        x = (x * 48271) % 2147483647
        return x / 2147483647
      }
      const picked = pickCards(random)
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((c) => c.code)).size).toBe(3)
      for (const c of picked) {
        expect(CARDS).toContain(c)
      }
    }
  })

  it('카드마다 수치 하나만 바뀐다', () => {
    const base = loadoutOf('hold')
    expect(base.damage).toBeGreaterThan(1)
    expect(loadoutOf('split').spread).toBe(true)
    expect(loadoutOf('rule').fireMs).toBeLessThan(base.fireMs)
    expect(loadoutOf('steel').maxMental).toBeGreaterThan(base.maxMental)
    expect(loadoutOf('calm').speed).toBeGreaterThan(base.speed)
  })
})
