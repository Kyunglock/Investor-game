import { describe, expect, it } from 'vitest'
import { EMPLOYEE_LADDER, LADDER } from './grades'

describe('등급 사다리', () => {
  it('15단계이고 X는 SSS 바로 위다', () => {
    expect(LADDER).toHaveLength(15)
    expect(LADDER.indexOf('X')).toBe(LADDER.indexOf('SSS') + 1)
  })

  it('직원 등급은 ZZZ 위로 XS·XSS·GOD까지 18단계다 (289번)', () => {
    expect(EMPLOYEE_LADDER).toHaveLength(18)
    expect(EMPLOYEE_LADDER.slice(-4)).toEqual(['ZZZ', 'XS', 'XSS', 'GOD'])
  })
})
