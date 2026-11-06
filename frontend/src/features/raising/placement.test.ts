import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { autoPlace, seatOne } from './placement'

function desk(code: string, statCode: string, sector: string | null = null, trades = true) {
  return { code, name: code, statCode, trades, sector, hot: false, description: '' }
}

const desks = [
  desk('semiconductor', 'courage', 'semiconductor'),
  desk('bio', 'patience', 'bio'),
  desk('energy', 'patience', 'energy'),
  desk('game', 'courage', 'game'),
  desk('food', 'conviction', 'food'),
  desk('finance', 'conviction', 'finance'),
  desk('day', 'courage'),
  desk('research', 'insight', null, false),
  desk('risk', 'conviction', null, false),
  desk('hr', 'insight', null, false),
]

function employee(
  id: number,
  insight: string,
  patience: string,
  courage: string,
  conviction: string,
  sector: string | null = null,
) {
  return { id, sector, grades: { insight, patience, courage, conviction, luck: 'C' } }
}

function company(
  seats: number,
  employees: unknown[],
  options: { omen?: string; hot?: string } = {},
): Company {
  return {
    seats,
    desks: desks.map((d) => ({ ...d, hot: d.code === options.hot })),
    employees,
    meeting: { wanted: '', omen: options.omen },
  } as unknown as Company
}

const deskOf = (seats: { employeeId: number; desk: string | null }[], id: number) =>
  seats.find((s) => s.employeeId === id)?.desk

describe('자동 배치 (decisions.md 232·233번)', () => {
  it('인내심 좋은 사람은 인내심 자리, 용기 좋은 사람은 용기 자리에 앉힌다', () => {
    const seats = autoPlace(
      company(2, [employee(1, 'C', 'D', 'A', 'C'), employee(2, 'C', 'S', 'D', 'C')]),
    )
    expect(deskOf(seats, 1)).toBe('semiconductor')
    expect(deskOf(seats, 2)).toBe('bio')
  })

  it('이 시대에 뜨는 자리와 관심 섹터를 먼저 고른다', () => {
    const brave = employee(1, 'C', 'D', 'A', 'C')
    expect(deskOf(autoPlace(company(1, [brave], { hot: 'game' })), 1)).toBe('game')
    expect(deskOf(autoPlace(company(1, [employee(1, 'C', 'D', 'A', 'C', 'game')])), 1)).toBe('game')
    // 뜨는 자리라도 원하는 능력치가 두 칸 넘게 낮으면 맞는 자리가 낫다.
    expect(deskOf(autoPlace(company(1, [brave], { hot: 'bio' })), 1)).toBe('semiconductor')
  })

  it('셋째는 리서치 팀(안목), 폭락 조짐이 있으면 리스크 관리 팀(줏대)', () => {
    const staff = [
      employee(1, 'D', 'S', 'D', 'D'),
      employee(2, 'D', 'D', 'S', 'D'),
      employee(3, 'S', 'D', 'D', 'C'),
      employee(4, 'D', 'D', 'D', 'A'),
    ]
    const calm = autoPlace(company(3, staff))
    expect(deskOf(calm, 1)).toBe('bio')
    expect(deskOf(calm, 2)).toBe('semiconductor')
    expect(deskOf(calm, 3)).toBe('research')
    expect(deskOf(calm, 4)).toBeNull()
    const stormy = autoPlace(company(3, staff, { omen: '폭락 조짐' }))
    expect(deskOf(stormy, 4)).toBe('risk')
    expect(deskOf(stormy, 3)).toBeNull()
  })

  it('자리가 모자라면 남은 사람은 쉬고, 혼자면 가장 맞는 자리에 앉는다', () => {
    const seats = autoPlace(
      company(2, [
        employee(1, 'C', 'A', 'D', 'C'),
        employee(2, 'C', 'D', 'A', 'C'),
        employee(3, 'S', 'S', 'S', 'S'),
      ]),
    )
    expect(seats.filter((s) => s.desk)).toHaveLength(2)
    expect(autoPlace(company(2, [employee(1, 'C', 'D', 'C', 'A')]))).toEqual([
      { employeeId: 1, desk: 'food' },
    ])
  })
})

describe('한 사람만 옮기기 (decisions.md 237번)', () => {
  it('고른 사람의 자리만 바꾸고 나머지는 그대로 둔다', () => {
    const c = company(2, [
      { ...employee(1, 'C', 'C', 'C', 'C'), desk: 'bio' },
      { ...employee(2, 'C', 'C', 'C', 'C'), desk: null },
    ])
    expect(seatOne(c, 2, 'day')).toEqual([
      { employeeId: 1, desk: 'bio' },
      { employeeId: 2, desk: 'day' },
    ])
    expect(seatOne(c, 1, null)).toEqual([
      { employeeId: 1, desk: null },
      { employeeId: 2, desk: null },
    ])
  })
})
