import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { TUTORIAL_STEPS, tutorialStep } from './tutorial'

function company(over: Partial<Company> = {}): Company {
  return { employees: [], lastQuarter: null, lastSettlement: null, ...over } as unknown as Company
}

describe('튜토리얼 걸음 (decisions.md 302번)', () => {
  it('직원이 없으면 뽑기, 앉은 사람이 없으면 앉히기, 첫 분기면 넘기기, 첫 해면 결산 읽기, 그 뒤는 키우기', () => {
    expect(tutorialStep(company())).toMatchObject({ id: 'hire', n: 1, tab: 'market' })
    const hired = company({ employees: [{ id: 1, desk: null }] } as never)
    expect(tutorialStep(hired)).toMatchObject({ id: 'place', n: 2, tab: 'staff' })
    const placed = company({ employees: [{ id: 1, desk: 'bio' }] } as never)
    expect(tutorialStep(placed)).toMatchObject({ id: 'meeting', n: 3, spot: 'settle' })
    const quartered = company({
      employees: [{ id: 1, desk: 'bio' }],
      lastQuarter: { year: 1, quarter: 1 },
    } as never)
    expect(tutorialStep(quartered)).toMatchObject({ id: 'sheet', n: 4 })
    const settled = company({
      employees: [{ id: 1, desk: 'bio' }],
      lastSettlement: { year: 1 },
    } as never)
    expect(tutorialStep(settled)).toMatchObject({ id: 'grow', n: TUTORIAL_STEPS })
  })

  it('걸음마다 제목과 설명이 있고 자리표시가 남지 않는다', () => {
    for (const c of [company(), company({ lastSettlement: { year: 1 } } as never)]) {
      const step = tutorialStep(c)
      expect(step.title).not.toBe('')
      expect(step.text).not.toContain('{')
    }
  })
})
