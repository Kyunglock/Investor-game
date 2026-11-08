import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { busyIds, collected, drawable, mergeGroups, mergePlan } from './gachaRules'

const e = (id: number, grade: string, desk: string | null = null, leader = false) => ({
  id,
  name: `직원${id}`,
  overallGrade: grade,
  desk,
  leader,
})

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
      mergeCount: 3,
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
  it('같은 등급 셋 이상이면 합칠 수 있고, 높은 등급부터', () => {
    const c = company({
      employees: [
        e(1, 'C'),
        e(2, 'C'),
        e(3, 'C'),
        e(4, 'B'),
        e(5, 'B'),
        e(6, 'F'),
        e(7, 'F'),
        e(8, 'F'),
        e(9, 'F'),
      ],
    })
    expect(mergeGroups(c).map((g) => [g.grade, g.members.length])).toEqual([
      ['C', 3],
      ['F', 4],
    ])
  })

  it('걸린 일이 있는 사람과 맨 위(GOD)는 빠진다', () => {
    const c = company({
      employees: [e(1, 'C'), e(2, 'C'), e(3, 'C'), e(4, 'GOD'), e(5, 'GOD'), e(6, 'GOD')],
      meeting: { wanted: '', poach: { employeeId: 3 } },
    })
    expect(busyIds(c)).toEqual(new Set([3]))
    expect(mergeGroups(c)).toEqual([])
  })

  it('바탕은 팀장·자리에 앉은 사람, 재료는 쉬는 사람부터', () => {
    const group = {
      grade: 'C' as const,
      members: [e(1, 'C'), e(2, 'C', 'bio'), e(3, 'C', 'day', true), e(4, 'C')],
    } as never
    const plan = mergePlan(group, 3)
    expect(plan.base.id).toBe(3)
    expect(plan.materials.map((m) => m.id)).toEqual([4, 1])
    expect(mergePlan(group, 3, 1).base.id).toBe(1)
  })

  it('한 번에 뽑을 수 있는 수와 도감', () => {
    expect(drawable(company())).toBe(5)
    expect(drawable(company({ gacha: { ...company().gacha, roster: 6 } }))).toBe(2)
    expect(drawable(company({ gacha: { ...company().gacha, tickets: 0 } }))).toBe(0)
    expect(collected(company())).toBe(2)
  })
})
