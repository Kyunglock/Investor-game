import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { companyEvents } from './events'

function company(over: Partial<Company> = {}): Company {
  return {
    companyId: 'c1',
    number: 1,
    year: 1,
    quarter: 1,
    capital: 100,
    grade: 'F',
    employees: [],
    lastQuarter: null,
    lastSettlement: null,
    ending: null,
    broke: null,
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

  it('합성으로 재료가 빠지면 떠남으로 치지 않는다 (314번)', () => {
    const before = company({
      employees: [
        { id: 1, name: '김대리', overallGrade: 'C' },
        { id: 2, name: '박과장', overallGrade: 'C' },
        { id: 3, name: '이주임', overallGrade: 'C' },
      ] as never,
    })
    const after = company({ employees: [{ id: 1, name: '김대리', overallGrade: 'B' }] as never })
    expect(companyEvents(before, after)).toEqual([])
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

  it('분기를 넘기면 분기 실적(폭락 여부), 해가 바뀌면 연말 결산과 업적', () => {
    const q = companyEvents(
      company(),
      company({
        quarter: 2,
        capital: 80,
        lastQuarter: { crash: true, capitalBefore: 100, capitalAfter: 80 },
      } as never),
    )
    expect(q[0]).toEqual({ kind: 'quarter', crash: true, delta: -20 })
    const y = companyEvents(
      company({ quarter: 4 }),
      company({
        year: 2,
        capital: 300,
        grade: 'E',
        lastSettlement: { capitalBefore: 100, capitalAfter: 300, achieved: ['첫 이사'] },
      } as never),
    )
    expect(y).toEqual([
      { kind: 'year-end', delta: 200, achieved: ['첫 이사'] },
      { kind: 'capital', delta: 200 },
      { kind: 'grade-up', to: 'E' },
    ])
  })

  it('건물이 줄거나, 랜드마크 타워에 오르거나, 파산이 새로 생기면 알린다', () => {
    expect(companyEvents(company({ grade: 'E' }), company({ grade: 'F' }))).toEqual([
      { kind: 'grade-down', to: 'F' },
    ])
    expect(companyEvents(company({ grade: 'XXX' }), company({ grade: 'Z' }))).toEqual([
      { kind: 'grade-up', to: 'Z' },
      { kind: 'landmark' },
    ])
    expect(companyEvents(company(), company({ broke: '금고가 비었다' }))).toEqual([
      { kind: 'broke' },
    ])
  })
})
