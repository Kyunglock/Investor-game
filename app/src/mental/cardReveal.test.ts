import { describe, expect, it } from 'vitest'
import { DEAL_MS, READY_GAP_MS, REVEAL_TIMING, revealPlan, topGrade } from './cardReveal'

describe('카드 펼치기 (decisions.md 393번)', () => {
  it('석 장이 깔린 뒤 왼쪽부터 한 장씩: 떨림 → 누움 → 앞면, 다음 카드는 앞 카드가 펼쳐진 뒤', () => {
    const { steps, ready } = revealPlan(['N', 'R', 'SR'])
    expect(steps[0].tease).toBe(DEAL_MS)
    for (const [i, s] of steps.entries()) {
      expect(s.tease).toBeLessThan(s.turn)
      expect(s.turn).toBeLessThan(s.face)
      if (i > 0) expect(s.tease).toBeGreaterThan(steps[i - 1].face)
    }
    expect(ready).toBe(steps[2].face + READY_GAP_MS)
  })

  it('등급이 높을수록 뜸과 여운이 길고, 전설은 1초 넘게 뜸을 들인다', () => {
    const order = ['N', 'R', 'SR', 'UR'] as const
    for (let i = 1; i < order.length; i++) {
      expect(REVEAL_TIMING[order[i]].tease).toBeGreaterThan(REVEAL_TIMING[order[i - 1]].tease)
      expect(REVEAL_TIMING[order[i]].after).toBeGreaterThan(REVEAL_TIMING[order[i - 1]].after)
    }
    expect(REVEAL_TIMING.UR.tease).toBeGreaterThanOrEqual(1000)
  })

  it('일반 석 장은 2초 안에, 전설이 섞여도 4초 안에 고를 수 있다', () => {
    expect(revealPlan(['N', 'N', 'N']).ready).toBeLessThan(2000)
    expect(revealPlan(['UR', 'SR', 'UR']).ready).toBeLessThan(5500)
    expect(revealPlan(['N', 'R', 'UR']).ready).toBeLessThan(4000)
  })

  it('건너뛸 때는 남은 카드 가운데 가장 높은 등급의 연출을 낸다', () => {
    expect(topGrade(['N', 'SR', 'R'])).toBe('SR')
    expect(topGrade(['UR', 'N'])).toBe('UR')
    expect(topGrade([])).toBe('N')
  })
})
