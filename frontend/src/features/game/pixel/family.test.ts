import { describe, expect, it } from 'vitest'
import type { Game } from '../../../api/client'
import { familyFigures } from './family'

const game = (married: boolean, ages: number[]): Game =>
  ({ household: { married, children: ages.map((age) => ({ age })) } }) as unknown as Game

describe('familyFigures', () => {
  it('혼자면 나만 anchor 자리에', () => {
    expect(familyFigures(game(false, []), 30, 36)).toEqual([{ who: 'me', stage: 'adult', x: 36 }])
  })

  it('결혼하면 배우자가 옆에, 아이는 나이대로 몸이 다르고 모두 배경 안에 서로 떨어져 선다', () => {
    const figures = familyFigures(game(true, [3, 10, 16]), 42, 36)
    expect(figures.map((f) => f.who)).toEqual(['me', 'spouse', 'kid', 'kid', 'kid'])
    expect(figures.map((f) => f.stage)).toEqual(['middle', 'middle', 'baby', 'child', 'adult'])
    for (const f of figures) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x + 16).toBeLessThanOrEqual(64)
    }
    const xs = figures.map((f) => f.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(12)
    }
  })

  it('아이만 있어도(배우자 없이) 아이가 선다', () => {
    expect(familyFigures(game(false, [5]), 30, 10).map((f) => f.who)).toEqual(['me', 'kid'])
  })
})
