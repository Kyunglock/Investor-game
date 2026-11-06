import { describe, expect, it } from 'vitest'
import { shines, TIER_RANK, tierClass, tierOf } from './GradeCard'
import { EMPLOYEE_LADDER } from './grades'

describe('캐릭터 카드의 등급 티어 (decisions.md 294번)', () => {
  it('등급 사다리를 무쇠 → 구리 → 은 → 금 → 사파이어 → 황금빛 → 무지개빛으로 나눈다', () => {
    expect(EMPLOYEE_LADDER.map(tierOf)).toEqual([
      'common',
      'common',
      'bronze',
      'bronze',
      'silver',
      'silver',
      'gold',
      'gold',
      'gold',
      'blue',
      'blue',
      'blue',
      'royal',
      'royal',
      'royal',
      'holo',
      'holo',
      'holo',
    ])
  })

  it('금부터 빛이 흐르고, 보석 수는 티어 순서대로 하나씩 는다', () => {
    expect(shines('silver')).toBe(false)
    expect(shines('gold')).toBe(true)
    expect(tierClass('silver')).toBe('tier-silver')
    expect(tierClass('holo')).toBe('tier-holo tier-shine')
    expect(TIER_RANK.common).toBe(1)
    expect(TIER_RANK.holo).toBe(7)
  })
})
