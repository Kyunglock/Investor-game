import { describe, expect, it } from 'vitest'
import {
  AUTO_PICK_MS,
  autoPickIndex,
  DEAL_MS,
  READY_GAP_MS,
  REVEAL_TIMING,
  revealPlan,
  TURN_MS,
  topGrade,
} from './cardReveal'

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

  it('펼치는 시간(뜸·뒤집기·여운)은 모든 등급이 같다 (#562·#585)', () => {
    for (const g of ['N', 'R', 'SR', 'UR'] as const) {
      expect(REVEAL_TIMING[g].tease).toBe(REVEAL_TIMING.N.tease)
      expect(REVEAL_TIMING[g].turn).toBe(TURN_MS)
      expect(REVEAL_TIMING[g].after).toBe(REVEAL_TIMING.N.after)
    }
    expect(revealPlan(['UR', 'SR', 'UR']).ready).toBe(revealPlan(['N', 'N', 'N']).ready)
  })

  it('빠르다: 한 장 0.3초, 석 장이 깔리고 1.7초 안에 고를 수 있다', () => {
    const t = REVEAL_TIMING.N
    expect(t.tease + t.turn + t.after).toBeLessThanOrEqual(300)
    expect(revealPlan(['N', 'R', 'UR']).ready).toBeLessThan(1700)
  })

  it('건너뛸 때는 남은 카드 가운데 가장 높은 등급의 연출을 낸다', () => {
    expect(topGrade(['N', 'SR', 'R'])).toBe('SR')
    expect(topGrade(['UR', 'N'])).toBe('UR')
    expect(topGrade([])).toBe('N')
  })
})

describe('카드 자동 선택 (#566)', () => {
  it('5초를 기다린다', () => {
    expect(AUTO_PICK_MS).toBe(5000)
  })

  it('등급이 가장 높은 카드, 같으면 마법 > 고양이 > 일반, 그래도 같으면 왼쪽', () => {
    expect(
      autoPickIndex([
        { grade: 'N', code: 'atk' },
        { grade: 'SR', code: 'meteor' },
        { grade: 'R', code: 'water' },
      ]),
    ).toBe(1)
    expect(
      autoPickIndex([
        { grade: 'R', code: 'cat' },
        { grade: 'R', code: 'water' },
      ]),
    ).toBe(1)
    expect(
      autoPickIndex([
        { grade: 'N', code: 'atk' },
        { grade: 'N', code: 'spd' },
        { grade: 'N', code: 'atk' },
      ]),
    ).toBe(0)
  })
})
