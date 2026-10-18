import { describe, expect, it } from 'vitest'
import { yearOf } from './labels'

describe('yearOf', () => {
  it('1세는 탄생 연도 2025년이다', () => {
    expect(yearOf(1)).toBe(2025)
  })

  it('31세는 2055년이다', () => {
    expect(yearOf(31)).toBe(2055)
  })
})
