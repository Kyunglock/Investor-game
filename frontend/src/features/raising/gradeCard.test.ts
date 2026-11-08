import { describe, expect, it } from 'vitest'
import { shines, TIER_RANK, tierClass, tierOf } from './GradeCard'
import { EMPLOYEE_LADDER, teamGrades } from './grades'

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

describe('결산서의 팀 등급 (decisions.md 397번)', () => {
  const staff = [
    { id: 1, overallGrade: 'B' as const },
    { id: 2, overallGrade: 'C' as const },
    { id: 3, overallGrade: 'S' as const },
    { id: 4, overallGrade: 'A' as const },
  ]

  it('팀장 등급과, 팀장을 뺀 팀원 등급을 높은 것부터', () => {
    expect(teamGrades(staff, 1, [2, 1, 3, 4])).toEqual({ leader: 'B', members: ['S', 'A', 'C'] })
    expect(teamGrades(staff, 2, [2])).toEqual({ leader: 'C', members: [] })
  })

  it('그새 떠난 사람은 빠진다', () => {
    expect(teamGrades(staff, 9, [9, 2, 8])).toEqual({ leader: undefined, members: ['C'] })
  })
})
