import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { groupRemarks, investTimeline, matchupOf, spokesperson } from './investShow'

type Result = NonNullable<NonNullable<Company['invest']>['outcome']>['results'][number]

const LABELS: Record<string, string> = { BUY: '산다', SELL: '판다', HOLD: '지켜본다' }
const label = (c: string) => LABELS[c]

const employees = [
  { id: 1, grades: { courage: 'F', conviction: 'SSS' } },
] as unknown as Company['employees']

function result(over: Partial<Result>): Result {
  return {
    employeeId: 1,
    name: '박주임',
    desk: 'day',
    action: 'BUY',
    follow: 'BOSS',
    pnl: 0,
    line: '',
    rival: null,
    ...over,
  }
}

describe('investTimeline', () => {
  it('막대 → 종목 공개 → 손익 → 회의 손익 → 결산 버튼 순서다', () => {
    const t = investTimeline(2, 2000, false)
    expect(t.tugAt(1)).toBeGreaterThan(t.tugAt(0) + 2000)
    expect(t.reveal).toBeGreaterThan(t.tugAt(1) + 2000)
    expect(t.pnlAt(0)).toBeGreaterThan(t.reveal)
    expect(t.total).toBeGreaterThan(t.pnlAt(1))
    expect(t.end).toBeGreaterThan(t.total)
  })

  it('셋부터는 막대가 겹쳐 돌아 오래 걸리지 않는다', () => {
    expect(investTimeline(5, 2000, false).reveal).toBeLessThan(
      investTimeline(2, 2000, false).reveal * 1.4,
    )
  })

  it('빨리 보기면 모두 바로다', () => {
    const t = investTimeline(3, 2000, true)
    expect([t.tugAt(2), t.pnlAt(2), t.reveal, t.total, t.end]).toEqual([0, 0, 0, 0, 0])
  })
})

describe('matchupOf', () => {
  it('맞붙을 것이 없었으면 막대가 없다', () => {
    expect(matchupOf(result({}), 'BUY', label, employees, '김대리')).toBeNull()
  })

  it('꼬드김에 넘어갔으면 오른쪽(단골 인물)이 이기고, 줏대 등급이 처음 몫이 된다', () => {
    const m = matchupOf(
      result({
        action: 'SELL',
        follow: 'SWAY',
        rival: { kind: 'SWAY', action: 'SELL', stat: 'conviction' },
      }),
      'BUY',
      label,
      employees,
      '김대리',
    )
    expect(m).toMatchObject({
      mine: { action: '산다', trait: '사장 말 · 줏대' },
      rival: { action: '판다', trait: '김대리의 꼬드김' },
      won: false,
      start: 80,
    })
  })

  it('제 판단을 이기고 사장 말대로 했으면 왼쪽이 이긴다. 낮은 등급도 처음 몫은 20%부터다', () => {
    const m = matchupOf(
      result({ rival: { kind: 'OWN', action: 'HOLD', stat: 'courage' } }),
      'BUY',
      label,
      employees,
      '김대리',
    )
    expect(m).toMatchObject({
      rival: { action: '지켜본다', trait: '제 판단' },
      won: true,
      start: 20,
    })
  })
})

describe('같은 의견끼리 모은 한마디 (decisions.md 242번)', () => {
  type Remark = NonNullable<Company['invest']>['remarks'][number]
  const remark = (employeeId: number, read: Remark['read']) =>
    ({ employeeId, name: `직원${employeeId}`, desk: 'day', read, text: '' }) as Remark

  it('사람이 많은 의견이 먼저이고, 같으면 사자 → 팔자 → 모르겠다, 아무도 없는 의견은 없다', () => {
    const groups = groupRemarks([
      remark(1, 'UP'),
      remark(2, 'DOWN'),
      remark(3, 'DOWN'),
      remark(4, 'UP'),
      remark(5, 'DOWN'),
    ])
    expect(groups.map((g) => [g.read, g.remarks.map((r) => r.employeeId)])).toEqual([
      ['DOWN', [2, 3, 5]],
      ['UP', [1, 4]],
    ])
    expect(groupRemarks([remark(1, 'NEUTRAL'), remark(2, 'DOWN')]).map((g) => g.read)).toEqual([
      'DOWN',
      'NEUTRAL',
    ])
    expect(groupRemarks([])).toEqual([])
  })
})

describe('같은 의견 칸의 대표 (decisions.md 246번)', () => {
  type Remark = NonNullable<Company['invest']>['remarks'][number]
  const remark = (employeeId: number) =>
    ({
      employeeId,
      name: `직원${employeeId}`,
      desk: 'day',
      read: 'UP',
      text: `말${employeeId}`,
    }) as Remark
  const staff = [
    { id: 1, grades: { insight: 'C' } },
    { id: 2, grades: { insight: 'S' } },
    { id: 3, grades: { insight: 'S' } },
  ] as unknown as Company['employees']

  it('칸에서 안목이 가장 높은 사람이 대표로 말하고, 같으면 앞사람이다', () => {
    expect(spokesperson([remark(1), remark(2), remark(3)], staff).employeeId).toBe(2)
    expect(spokesperson([remark(1)], staff).employeeId).toBe(1)
  })
})
