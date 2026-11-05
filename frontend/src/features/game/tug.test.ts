import { describe, expect, it } from 'vitest'
import { type Matchup, tugSteps } from './tug'

describe('tugSteps', () => {
  it('양쪽으로 엎치락뒤치락하다 마지막엔 지는 쪽이 밀어붙이고, 이긴 쪽이 끝까지 찬다', () => {
    for (const won of [true, false]) {
      const m: Matchup = {
        stat: 'courage',
        mine: { action: '산다', trait: '용기' },
        rival: { action: '지켜본다', trait: '망설임' },
        start: 50,
        won,
      }
      const steps = tugSteps(m)
      const swings = steps.slice(1, -1).map((s) => Math.sign(s.share - m.start))
      // 방향이 매번 바뀐다
      for (let i = 1; i < swings.length; i++) {
        expect(swings[i]).toBe(-swings[i - 1])
      }
      expect(swings.at(-1)).toBe(won ? -1 : 1)
      expect(steps.at(-1)?.share).toBe(won ? 100 : 0)
      const times = steps.map((s) => s.at)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })
})
