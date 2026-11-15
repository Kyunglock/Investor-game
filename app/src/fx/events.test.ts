import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { companyEvents } from './events'

function company(over: Partial<Company> = {}): Company {
  return {
    companyId: 'c1',
    number: 1,
    capital: 100,
    grade: 'F',
    employees: [],
    ...over,
  } as unknown as Company
}

describe('회사 변화의 효과 (decisions.md 310번)', () => {
  it('처음 회사가 생기거나 다른 회사가 되면 열림', () => {
    expect(companyEvents(null, company())).toEqual([{ kind: 'opened', number: 1 }])
    expect(companyEvents(company(), company({ companyId: 'c2', number: 2 }))).toEqual([
      { kind: 'opened', number: 2 },
    ])
    expect(companyEvents(company(), null)).toEqual([])
  })

  it('자본이 바뀌면 변화량, 사람이 들고 나면 이름', () => {
    const before = company({ employees: [{ id: 1, name: '김대리' }] as never })
    const after = company({ capital: 90, employees: [{ id: 2, name: '박과장' }] as never })
    expect(companyEvents(before, after)).toEqual([
      { kind: 'capital', delta: -10 },
      { kind: 'hired', name: '박과장' },
      { kind: 'left', name: '김대리' },
    ])
  })

  it('확장을 사서 건물이 오르면 자본 변화와 함께 알린다', () => {
    expect(companyEvents(company(), company({ capital: 70, grade: 'E' }))).toEqual([
      { kind: 'capital', delta: -30 },
      { kind: 'grade-up', to: 'E' },
    ])
  })

  it('건물이 줄거나 랜드마크 타워에 오르면 알린다', () => {
    expect(companyEvents(company({ grade: 'E' }), company({ grade: 'F' }))).toEqual([
      { kind: 'grade-down', to: 'F' },
    ])
    expect(companyEvents(company({ grade: 'XXX' }), company({ grade: 'Z' }))).toEqual([
      { kind: 'grade-up', to: 'Z' },
      { kind: 'landmark' },
    ])
  })
})
