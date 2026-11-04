import { describe, expect, it } from 'vitest'
import type { Game, Outcome } from '../../api/client'
import { matchupFor, tugSteps } from './tug'

const game = (held = false) =>
  ({
    stats: { insight: 50, patience: 70, courage: 35, conviction: 10, luck: 50 },
    holdings: held ? [{ stockCode: 's', quantity: 3 }] : [],
  }) as unknown as Pick<Game, 'stats' | 'holdings'>
const outcome = (over: Partial<Outcome>): Outcome =>
  ({
    kind: 'NEWS',
    chosen: 'BUY',
    actual: 'BUY',
    deviations: [],
    growth: [],
    price: { stockCode: 's' },
    ...over,
  }) as Outcome
const pair = (o: Outcome, held = false) => {
  const m = matchupFor(o, game(held))
  return [`${m.mine.action}·${m.mine.trait}`, `${m.rival.action}·${m.rival.trait}`, m.won]
}

describe('matchupFor: 고른 행동 vs 뒤집힐 수 있던 행동 (decisions.md 181번)', () => {
  it('매수·매도를 그대로 했으면 용기가 망설임(관망)을 이긴다. 처음 몫은 내 용기', () => {
    expect(pair(outcome({}))).toEqual(['매수한다·용기', '관망한다·망설임', true])
    expect(pair(outcome({ chosen: 'SELL', actual: 'SELL' }), true)).toEqual([
      '매도한다·용기',
      '관망한다·망설임',
      true,
    ])
    expect(matchupFor(outcome({}), game()).start).toBe(35)
  })

  it('관망: 들고 있으면 인내심 vs 조급함(매도), 없으면 줏대 vs 꼬드김(매수)', () => {
    expect(pair(outcome({ chosen: 'HOLD', actual: 'HOLD' }), true)).toEqual([
      '관망한다·인내심',
      '매도한다·조급함',
      true,
    ])
    expect(pair(outcome({ chosen: 'HOLD', actual: 'HOLD' }))).toEqual([
      '관망한다·줏대',
      '매수한다·꼬드김',
      true,
    ])
  })

  it('흔들림은 버틴다 vs 판다', () => {
    expect(pair(outcome({ kind: 'SHAKE', chosen: 'HOLD', actual: 'HOLD' }), true)).toEqual([
      '버틴다·인내심',
      '판다·조급함',
      true,
    ])
    expect(pair(outcome({ kind: 'SHAKE', chosen: 'SELL', actual: 'HOLD' }), true)).toEqual([
      '판다·용기',
      '버틴다·망설임',
      false,
    ])
  })

  it('뒤집혔으면 실제 행동이 상대이고 반대 힘이 이긴다', () => {
    expect(pair(outcome({ chosen: 'HOLD', actual: 'BUY' }))).toEqual([
      '관망한다·줏대',
      '매수한다·꼬드김',
      false,
    ])
    expect(pair(outcome({ chosen: 'BUY', actual: 'SELL' }), true)).toEqual([
      '매수한다·줏대',
      '매도한다·꼬드김',
      false,
    ])
    // 줏대 10이라도 처음엔 20%는 버틴다
    expect(matchupFor(outcome({ chosen: 'HOLD', actual: 'BUY' }), game()).start).toBe(20)
  })
})

describe('tugSteps', () => {
  it('양쪽으로 엎치락뒤치락하다 마지막엔 지는 쪽이 밀어붙이고, 이긴 쪽이 끝까지 찬다', () => {
    for (const won of [true, false]) {
      const m = matchupFor(outcome(won ? {} : { actual: 'HOLD' }), game())
      const steps = tugSteps(m)
      const swings = steps.slice(1, -1).map((s) => Math.sign(s.share - m.start))
      // 방향이 매번 바뀐다
      for (let i = 1; i < swings.length; i++) {
        expect(swings[i]).toBe(-swings[i - 1])
      }
      expect(swings.at(-1)).toBe(won ? -1 : 1)
      expect(steps.at(-1)?.share).toBe(won ? 100 : 0)
      const times = steps.map((s) => s.at)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })
})
