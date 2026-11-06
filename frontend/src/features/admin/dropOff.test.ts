import { describe, expect, it } from 'vitest'
import { dropOff } from './AdminPage'

const company = (year: number, status: string, employees: number, number = 1, sold = false) =>
  ({ year, status, employees, number, sold }) as never

describe('첫 회사가 멈춘 해 (decisions.md 228·263번)', () => {
  it('도는 중이거나 망해서 닫은 첫 회사를 해별로 세고, 팔린 회사는 빼고, 아무도 뽑지 않은 회사를 따로 센다', () => {
    const rows = dropOff([
      company(1, 'ACTIVE', 0),
      company(1, 'ACTIVE', 2),
      company(3, 'ACTIVE', 1),
      company(4, 'ENDED', 2, 1, true),
      company(5, 'ENDED', 0),
      company(2, 'ACTIVE', 1, 2),
    ])
    expect(rows).toEqual([
      { year: 1, all: 2, noStaff: 1 },
      { year: 3, all: 1, noStaff: 0 },
      { year: 5, all: 1, noStaff: 1 },
    ])
  })
})
