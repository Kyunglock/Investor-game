import { describe, expect, it } from 'vitest'
import {
  BUY_PERCENTS,
  changeBp,
  quantityForCash,
  quantityForHolding,
  SELL_PERCENTS,
  signedPercent,
} from './market'

describe('quantityForCash', () => {
  it('현금의 비율을 가격으로 나눠 버림한다', () => {
    expect(quantityForCash(1_000_000, 72_000, 50)).toBe(6)
    expect(quantityForCash(1_000_000, 72_000, 100)).toBe(13)
  })

  it('가격이 0 이하이거나 현금이 모자라면 0이다', () => {
    expect(quantityForCash(1_000_000, 0, 50)).toBe(0)
    expect(quantityForCash(50_000, 72_000, 100)).toBe(0)
  })
})

describe('quantityForHolding', () => {
  it('보유의 비율을 버림하고 100%는 전량이다', () => {
    expect(quantityForHolding(42, 50)).toBe(21)
    expect(quantityForHolding(7, 25)).toBe(1)
    expect(quantityForHolding(42, 100)).toBe(42)
  })
})

describe('changeBp', () => {
  it('변화율을 만분율로, 기준이 0 이하면 0', () => {
    expect(changeBp(118_500, 115_000)).toBe(304)
    expect(changeBp(90, 100)).toBe(-1000)
    expect(changeBp(100, 0)).toBe(0)
  })
})

describe('signedPercent', () => {
  it('부호와 소수 한 자리', () => {
    expect(signedPercent(230)).toBe('+2.3%')
    expect(signedPercent(-180)).toBe('−1.8%')
    expect(signedPercent(0)).toBe('0.0%')
  })
})

describe('빠른 버튼', () => {
  it('매수는 10/25/50/100, 매도는 25/50/100', () => {
    expect([...BUY_PERCENTS]).toEqual([10, 25, 50, 100])
    expect([...SELL_PERCENTS]).toEqual([25, 50, 100])
  })
})
