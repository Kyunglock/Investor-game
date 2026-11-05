import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { autoPlace } from './placement'

const desks = [
  { code: 'bio', name: '바이오 데스크', statCode: 'patience', trades: true, description: '' },
  { code: 'day', name: '단타 데스크', statCode: 'courage', trades: true, description: '' },
  { code: 'research', name: '리서치 팀', statCode: 'insight', trades: false, description: '' },
  { code: 'risk', name: '리스크 관리 팀', statCode: 'conviction', trades: false, description: '' },
  { code: 'hr', name: '인사팀', statCode: 'insight', trades: false, description: '' },
]

function employee(
  id: number,
  insight: string,
  patience: string,
  courage: string,
  conviction: string,
) {
  return { id, grades: { insight, patience, courage, conviction, luck: 'C' } }
}

function company(seats: number, employees: unknown[], omen?: string): Company {
  return { seats, desks, employees, meeting: { wanted: '', omen } } as unknown as Company
}

const deskOf = (seats: { employeeId: number; desk: string | null }[], id: number) =>
  seats.find((s) => s.employeeId === id)?.desk

describe('자동 배치 (decisions.md 232번)', () => {
  it('인내심 좋은 사람은 바이오, 용기 좋은 사람은 단타에 앉힌다', () => {
    const seats = autoPlace(
      company(2, [employee(1, 'C', 'D', 'A', 'C'), employee(2, 'C', 'S', 'D', 'C')]),
    )
    expect(deskOf(seats, 1)).toBe('day')
    expect(deskOf(seats, 2)).toBe('bio')
  })

  it('두 사람의 맞는 정도를 더해 짝을 고른다: 한 사람이 둘 다 잘해도 둘이 같이 맞는 쪽', () => {
    // 1은 인내심·용기 모두 S, 2는 인내심만 A. 1을 바이오에 두면 2가 단타(F)로 가서 손해다.
    const seats = autoPlace(
      company(2, [employee(1, 'C', 'S', 'S', 'C'), employee(2, 'C', 'A', 'F', 'C')]),
    )
    expect(deskOf(seats, 1)).toBe('day')
    expect(deskOf(seats, 2)).toBe('bio')
  })

  it('셋째는 리서치 팀(안목), 폭락 조짐이 있으면 리스크 관리 팀(줏대)', () => {
    const staff = [
      employee(1, 'D', 'A', 'D', 'D'),
      employee(2, 'D', 'D', 'A', 'D'),
      employee(3, 'S', 'D', 'D', 'C'),
      employee(4, 'D', 'D', 'D', 'S'),
    ]
    const calm = autoPlace(company(3, staff))
    expect(deskOf(calm, 3)).toBe('research')
    expect(deskOf(calm, 4)).toBeNull()
    const stormy = autoPlace(company(3, staff, '폭락 조짐'))
    expect(deskOf(stormy, 4)).toBe('risk')
    expect(deskOf(stormy, 3)).toBeNull()
  })

  it('자리가 모자라면 남은 사람은 쉬고, 혼자면 더 맞는 쪽에 앉는다', () => {
    const seats = autoPlace(
      company(2, [
        employee(1, 'C', 'A', 'D', 'C'),
        employee(2, 'C', 'D', 'A', 'C'),
        employee(3, 'S', 'S', 'S', 'S'),
      ]),
    )
    expect(seats.filter((s) => s.desk)).toHaveLength(2)
    expect(autoPlace(company(2, [employee(1, 'C', 'D', 'A', 'C')]))).toEqual([
      { employeeId: 1, desk: 'day' },
    ])
  })
})
