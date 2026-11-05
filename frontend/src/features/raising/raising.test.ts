import { describe, expect, it } from 'vitest'
import { LADDER, ladderTone } from './grades'

describe('등급 사다리', () => {
  it('15단계이고 X는 파란색, Z는 금색이다', () => {
    expect(LADDER).toHaveLength(15)
    expect(LADDER.indexOf('X')).toBe(LADDER.indexOf('SSS') + 1)
    expect(ladderTone('SSS')).not.toMatch(/down|gold/)
    expect(ladderTone('XX')).toContain('bg-down')
    expect(ladderTone('ZZZ')).toContain('bg-gold')
  })
})
