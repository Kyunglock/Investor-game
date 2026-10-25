import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Outcome } from '../../api/client'
import { frugalMoment, momentForNotice, momentForOutcome } from './moments'

const game = (over: Partial<Game> = {}): Game =>
  ({
    day: 9000,
    totalAsset: 100_000_000,
    cash: 5_000_000,
    debt: 0,
    sex: 'F',
    household: { monthlyExpense: 2_000_000 },
    log: [],
    ...over,
  }) as unknown as Game

const outcome = (over: Partial<Outcome>): Outcome =>
  ({ kind: 'NEWS', chosen: 'BUY', actual: 'BUY', deviations: [], growth: [], ...over }) as Outcome

describe('momentForOutcome', () => {
  it('아이가 태어난 생활 선택은 기쁨', () => {
    const child: LogEntry = {
      seq: 9,
      day: 9000,
      kind: 'CHILD',
      payload: { seq: 2, cost: 1, sex: 'M' },
    }
    const m = momentForOutcome(
      outcome({ kind: 'LIFE', chosen: 'ACCEPT', actual: 'ACCEPT' }),
      game({ log: [child] }),
    )
    expect(m?.mood).toBe('joy')
    expect(m?.art.vignette).toBe('baby')
    expect(m?.caption).toContain('둘째 아들')
    expect(m?.art.figures.map((f) => [f.who, f.sex])).toEqual([['me', 'F']])
    const married = game({ log: [child], household: { married: true } as Game['household'] })
    expect(
      momentForOutcome(
        outcome({ kind: 'LIFE', chosen: 'ACCEPT', actual: 'ACCEPT' }),
        married,
      )?.art.figures.map((f) => [f.who, f.sex]),
    ).toEqual([
      ['me', 'F'],
      ['spouse', 'M'],
    ])
    expect(momentForOutcome(outcome({ kind: 'LIFE' }), game())).toBeNull()
  })

  it('총자산의 5%를 넘는 손익이면 급등은 자신감, 급락은 좌절', () => {
    const price = (pnl: number) =>
      ({
        stockName: 'A',
        direction: pnl > 0 ? 'UP' : 'DOWN',
        changeBp: 1000,
        pnl,
      }) as Outcome['price']
    expect(momentForOutcome(outcome({ price: price(6_000_000) }), game())?.mood).toBe('confident')
    expect(momentForOutcome(outcome({ price: price(-6_000_000) }), game())?.art.vignette).toBe(
      'crash',
    )
    expect(momentForOutcome(outcome({ price: price(-1_000_000) }), game())).toBeNull()
  })
})

describe('momentForNotice', () => {
  it('가족 여행 알림에만 그림이 붙는다', () => {
    const trip: LogEntry = {
      seq: 1,
      day: 1,
      kind: 'LIFE',
      payload: { noticeCode: 'family-trip', title: '가족 여행', amount: -2_500_000 },
    }
    const other: LogEntry = {
      seq: 2,
      day: 1,
      kind: 'LIFE',
      payload: { noticeCode: 'hospital', title: '병원비', amount: -1 },
    }
    expect(momentForNotice(trip, game())?.art.vignette).toBe('trip')
    expect(momentForNotice(trip, game())?.art.figures.map((f) => f.sex)).toEqual(['F', 'M'])
    expect(momentForNotice(other, game())).toBeNull()
  })
})

describe('frugalMoment', () => {
  it('현금이 한 달 생활비에 못 미치거나 빚이 있으면 긴축, 독립 전(생활비 0)은 아니다', () => {
    expect(frugalMoment(game())).toBeNull()
    expect(frugalMoment(game({ cash: 1_000_000 }))?.mood).toBe('frugal')
    expect(frugalMoment(game({ debt: 1 }))?.caption).toContain('빚')
    expect(
      frugalMoment(game({ cash: 0, household: { monthlyExpense: 0 } as Game['household'] })),
    ).toBeNull()
  })
})
