import { describe, expect, it } from 'vitest'
import { dropOff } from './AdminPage'

const run = (card: number, status: string, kind: string | null, scripted = false) =>
  ({ card, status, kind, scripted }) as never

describe('육성 판이 멈춘 카드 (증권사 육성 설계 11.5절)', () => {
  it('끝내지 않은 판만 카드별로 세고, 짜인 첫 판을 따로 센다', () => {
    const rows = dropOff([
      run(3, 'ABANDONED', 'NEWS', true),
      run(3, 'ACTIVE', 'NEWS'),
      run(0, 'ABANDONED', 'TRAIT', true),
      run(12, 'ENDED', null),
    ])
    expect(rows).toEqual([
      { card: 0, kind: '성향', all: 1, first: 1 },
      { card: 3, kind: '뉴스', all: 2, first: 1 },
    ])
  })
})
