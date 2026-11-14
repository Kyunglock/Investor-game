import { describe, expect, it } from 'vitest'
import { money, signedMoney, withParticle } from './labels'

describe('게임 금액 (decisions.md 313번)', () => {
  it('1,000마다 a·b·c·d로 올라가고 앞자리는 세 자리까지', () => {
    expect(money(0)).toBe('0')
    expect(money(950)).toBe('950')
    expect(money(3_500)).toBe('3.5a')
    expect(money(500_000)).toBe('500a')
    expect(money(3_120_000)).toBe('3.12b')
    expect(money(100_000_000)).toBe('100b')
    expect(money(248_580_568)).toBe('249b')
    expect(money(41_250_000)).toBe('41.3b')
    expect(money(1_200_000_000)).toBe('1.2c')
    expect(money(56_361_500_000_000)).toBe('56.4d')
    expect(money(1_000_000_000_000_000)).toBe('1e')
    // 자동 전투의 물가로 돈이 z를 넘는다 (decisions.md 505번): z 다음은 aa, ab …
    expect(money(1e18)).toBe('1f')
    expect(money(2.5e78)).toBe('2.5z')
    expect(money(1e81)).toBe('1aa')
    expect(money(3.3e84)).toBe('3.3ab')
    expect(money(9.99e158)).toBe('999az')
    expect(money(1e159)).toBe('1ba')
    expect(money(-5_200_000)).toBe('−5.2b')
  })

  it('반올림으로 1000이 되면 다음 단위로 올린다', () => {
    expect(money(999_960_000)).toBe('1c')
    expect(money(999_499)).toBe('999a')
  })

  it('부호를 붙인다', () => {
    expect(signedMoney(3_500)).toBe('+3.5a')
    expect(signedMoney(-45_300_000)).toBe('−45.3b')
    expect(signedMoney(0)).toBe('0')
  })
})

describe('withParticle', () => {
  it('받침에 맞는 조사를 붙인다', () => {
    expect(withParticle('한탕증권', '을', '를')).toBe('한탕증권을')
    expect(withParticle('불개미투자', '을', '를')).toBe('불개미투자를')
  })
})
