import { describe, expect, it } from 'vitest'
import { shortWon } from './labels'

describe('shortWon', () => {
  it('억·만 단위로 줄이고 만원 아래는 버린다', () => {
    expect(shortWon(248_580_568)).toBe('2억 4,858만원')
    expect(shortWon(200_000_000)).toBe('2억원')
    expect(shortWon(3_120_000)).toBe('312만원')
    expect(shortWon(12_345_678_901)).toBe('123억 4,567만원')
    expect(shortWon(9_999)).toBe('9,999원')
    expect(shortWon(0)).toBe('0원')
    expect(shortWon(-5_200_000)).toBe('−520만원')
  })
})
