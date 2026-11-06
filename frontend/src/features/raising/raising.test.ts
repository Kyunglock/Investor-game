import { describe, expect, it } from 'vitest'
import { fitOf } from './CompanyScreen'
import { gradeLabel, gradeTier, LADDER } from './grades'

describe('등급 사다리', () => {
  it('15단계이고 X는 SSS 바로 위다', () => {
    expect(LADDER).toHaveLength(15)
    expect(LADDER.indexOf('X')).toBe(LADDER.indexOf('SSS') + 1)
  })

  it('SSS 위는 EX·EX+·EX++, 그 위는 별 하나·둘·셋으로 보인다 (287번)', () => {
    expect(LADDER.map(gradeLabel)).toEqual([
      'F',
      'E',
      'D',
      'C',
      'B',
      'A',
      'S',
      'SS',
      'SSS',
      'EX',
      'EX+',
      'EX++',
      '★',
      '★★',
      '★★★',
    ])
    // 모르는 글자는 그대로 둔다.
    expect(gradeLabel('?')).toBe('?')
  })

  it('세 칸씩 한 층이고, 층 안에서 단계가 오른다', () => {
    expect(LADDER.map((g) => gradeTier(g).tier)).toEqual([
      ...Array(3).fill('low'),
      ...Array(3).fill('mid'),
      ...Array(3).fill('high'),
      ...Array(3).fill('ex'),
      ...Array(3).fill('star'),
    ])
    expect(['SS', 'SSS', 'X', 'ZZZ'].map((g) => gradeTier(g as never).step)).toEqual([2, 3, 1, 3])
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
