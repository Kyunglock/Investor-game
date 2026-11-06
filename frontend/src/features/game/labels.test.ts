import { describe, expect, it } from 'vitest'
import { shortWon, withParticle } from './labels'

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

  it('1조가 넘으면 조와 억까지만 쓴다 (decisions.md 252번)', () => {
    expect(shortWon(56_361_500_000_000)).toBe('56조 3,615억원')
    expect(shortWon(1_000_000_000_000)).toBe('1조원')
    expect(shortWon(1_000_000_000_000_000)).toBe('1,000조원')
    expect(shortWon(-2_500_012_340_000)).toBe('−2조 5,000억원')
  })
})

describe('withParticle', () => {
  it('받침에 맞는 조사를 붙인다', () => {
    expect(withParticle('한탕증권', '을', '를')).toBe('한탕증권을')
    expect(withParticle('불개미투자', '을', '를')).toBe('불개미투자를')
  })
})
