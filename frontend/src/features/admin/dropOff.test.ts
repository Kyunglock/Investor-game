import { describe, expect, it } from 'vitest'
import { dropOff } from './AdminPage'

const company = (status: string, employees: number, number = 1, sold = false) =>
  ({ status, employees, number, sold }) as never

describe('첫 회사 가운데 직원이 없는 회사 (decisions.md 228·264번)', () => {
  it('첫 회사만 세고, 팔린 회사는 빼고, 아무도 뽑지 않은 회사를 따로 센다', () => {
    const first = dropOff([
      company('ACTIVE', 0),
      company('ACTIVE', 2),
      company('ACTIVE', 1),
      company('ENDED', 2, 1, true),
      company('ENDED', 0),
      company('ACTIVE', 1, 2),
    ])
    expect(first).toEqual({ all: 4, noStaff: 2 })
  })
})
