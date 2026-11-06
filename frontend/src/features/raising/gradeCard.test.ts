import { describe, expect, it } from 'vitest'
import { frameStyle, tierOf } from './GradeCard'
import { EMPLOYEE_LADDER } from './grades'

describe('캐릭터 카드의 등급 티어 (decisions.md 294번)', () => {
  it('등급 사다리를 회색 → 구리 → 은 → 금 → 파란빛 → 금빛 → 무지개빛으로 나눈다', () => {
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

  it('금부터 테두리에 빛이 흐르고, 파란빛부터 그림자가 번진다', () => {
    expect(frameStyle('silver').backgroundSize).toBeUndefined()
    expect(frameStyle('gold').backgroundSize).toBe('auto, 300% 300%')
    expect(frameStyle('gold').boxShadow).toBeUndefined()
    expect(frameStyle('blue').boxShadow).toContain('rgba(45, 93, 168')
    expect(frameStyle('holo').background).toContain('#c77dff')
  })
})
