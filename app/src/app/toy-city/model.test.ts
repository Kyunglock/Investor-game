import type { Company, Grade } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { companyMood, expansionSide, growthProgress, officeGeometry } from './model'

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

  it('분위기는 배치된 직원의 사기만 반영한다', () => {
    const company = {
      employees: [
        { desk: 'bio', morale: -2 },
        { desk: null, morale: 2 },
      ],
    } as Company
    expect(companyMood(company)).toBe('지침')
    expect(companyMood({ employees: [] } as unknown as Company)).toBe('준비 중')
  })
})
