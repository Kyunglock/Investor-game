import type { Company, Grade } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import {
  expansionSide,
  growthProgress,
  MOVE_DONE,
  MOVE_MS,
  moveTimeline,
  officeGeometry,
  rivalShown,
} from './model'

describe('토이시티의 실제 회사 상태 표시', () => {
  it('다섯 번의 확장은 왼쪽·오른쪽을 번갈아 밀어낸다', () => {
    expect((['E', 'D', 'C', 'B', 'A'] as Grade[]).map(expansionSide)).toEqual([
      'left',
      'right',
      'left',
      'right',
      'left',
    ])
  })

  it.each([4, 6, 10, 14, 18, 22, 26, 30, 34])(
    '%i명 규모에서도 고양이가 건물 안에 겹치지 않고 들어간다',
    (seats) => {
      const g = officeGeometry('A', seats)
      expect(g.positions).toHaveLength(seats)
      expect((g.height + 31) * g.scale).toBeLessThanOrEqual(265)
      for (const p of g.positions) {
        expect(p.x).toBeGreaterThanOrEqual(g.x)
        expect(p.x + 36).toBeLessThanOrEqual(g.x + g.width)
        expect(p.y).toBeGreaterThan(560 - g.height)
        expect(p.y + 60).toBeLessThan(560)
        for (const other of g.positions.filter((q) => q !== p && q.y === p.y)) {
          expect(Math.abs(p.x - other.x)).toBeGreaterThanOrEqual(36)
        }
      }
    },
  )

  it('확장 기준과 공사 진행률은 서버의 비용·기간을 따른다', () => {
    const company = {
      capital: 80,
      upgrade: { needed: 100, affordable: false, years: 4, left: null },
    } as Company
    expect(growthProgress(company).percent).toBe(80)
    if (!company.upgrade) throw new Error('테스트 회사의 확장 계획 누락')
    company.upgrade = { ...company.upgrade, left: 2 }
    expect(growthProgress(company)).toEqual({ percent: 50, label: '공사 중 · 완공까지 2년' })
    company.upgrade.left = 0
    expect(growthProgress(company)).toEqual({ percent: 100, label: '공사 중 · 완공까지 0년' })
  })

  it('확장 연출은 힘 모으기·부딪힘·커지기·축하를 2~2.5초에 차례로 지나고, 내려갈 때는 축하가 없다', () => {
    const up = moveTimeline(true)
    expect(up.map((s) => s.phase)).toEqual([1, 2, 3, MOVE_DONE])
    expect(up.map((s) => s.at)).toEqual([...up.map((s) => s.at)].sort((a, b) => a - b))
    expect(up.at(-1)?.at).toBe(MOVE_MS)
    expect(MOVE_MS).toBeGreaterThanOrEqual(2000)
    expect(MOVE_MS).toBeLessThanOrEqual(2500)
    const down = moveTimeline(false)
    expect(down.map((s) => s.phase)).not.toContain(3)
    expect(down.at(-1)?.phase).toBe(MOVE_DONE)
  })
})

describe('확장 뒤 밀어낸 자리 (415번)', () => {
  it('등급이 오르면 밀어낸 쪽은 축하·끝 모습에 빈자리다', () => {
    expect(rivalShown('left', 'left', 2, true)).toBe(true)
    expect(rivalShown('left', 'left', 3, true)).toBe(false)
    expect(rivalShown('left', 'left', 4, true)).toBe(false)
    expect(rivalShown('right', 'left', 4, true)).toBe(true)
  })

  it('등급이 내려가면 부수지 않으니 그대로다', () => {
    expect(rivalShown('left', 'left', 4, false)).toBe(true)
  })
})
