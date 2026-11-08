import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { collected, drawable } from './gachaRules'

function company(over: Record<string, unknown> = {}): Company {
  return {
    employees: [],
    meeting: { wanted: '' },
    gacha: {
      tickets: 5,
      roster: 0,
      rosterMax: 8,
      draws: 0,
      maxDraws: 10,
      rates: [],
      drawn: [],
      collection: [
        { grade: 'F', count: 2 },
        { grade: 'E', count: 0 },
        { grade: 'D', count: 1 },
      ],
    },
    ...over,
  } as unknown as Company
}

describe('채용 뽑기 (decisions.md 312번)', () => {
  it('한 번에 뽑을 수 있는 수와 도감', () => {
    expect(drawable(company())).toBe(5)
    expect(drawable(company({ gacha: { ...company().gacha, roster: 6 } }))).toBe(2)
    expect(drawable(company({ gacha: { ...company().gacha, tickets: 0 } }))).toBe(0)
    expect(collected(company())).toBe(2)
  })
})
