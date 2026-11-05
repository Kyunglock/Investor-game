import { describe, expect, it } from 'vitest'
import { fitOf } from './CompanyScreen'
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

describe('자리에 맞는 정도 (증권사 육성 설계 4.2절)', () => {
  const desk = {
    code: 'bio',
    name: '바이오 데스크',
    statCode: 'patience',
    trades: true,
    sector: 'bio',
    hot: false,
    description: '',
  }
  const employee = (patience: string) => ({ grades: { patience } }) as never

  it('자리가 원하는 능력치가 A 이상이면 잘 맞고, C·B는 보통, 그 아래는 안 맞는다', () => {
    expect(fitOf(employee('SSS'), desk)).toBe('good')
    expect(fitOf(employee('A'), desk)).toBe('good')
    expect(fitOf(employee('B'), desk)).toBe('fair')
    expect(fitOf(employee('C'), desk)).toBe('fair')
    expect(fitOf(employee('D'), desk)).toBe('poor')
  })
})
