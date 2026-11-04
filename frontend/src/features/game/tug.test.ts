import { describe, expect, it } from 'vitest'
import type { Outcome, Stats } from '../../api/client'
import { matchupFor, tugSteps } from './tug'

const stats: Stats = { insight: 50, patience: 70, courage: 35, conviction: 10, luck: 50 }
const outcome = (over: Partial<Outcome>): Outcome =>
  ({ kind: 'NEWS', chosen: 'BUY', actual: 'BUY', deviations: [], growth: [], ...over }) as Outcome

describe('matchupFor (decisions.md 181번)', () => {
  it('매수·매도를 그대로 했으면 용기가 망설임을 이긴다. 처음 몫은 내 용기', () => {
    expect(matchupFor(outcome({}), stats)).toEqual({
      stat: 'courage',
      mine: '용기',
      rival: '망설임',
      start: 35,
      won: true,
    })
  })

  it('관망(버틴다)을 지켰으면 인내심 vs 조급함', () => {
    const m = matchupFor(outcome({ kind: 'SHAKE', chosen: 'HOLD', actual: 'HOLD' }), stats)
    expect([m.mine, m.rival, m.won]).toEqual(['인내심', '조급함', true])
  })

  it('뒤집혔으면 손을 뒤집은 능력치의 싸움이고 반대 힘이 이긴다', () => {
    const m = matchupFor(
      outcome({
        chosen: 'HOLD',
        actual: 'BUY',
        deviations: [{ statCode: 'conviction', from: 'HOLD', to: 'BUY' }],
      }),
      stats,
    )
    expect([m.mine, m.rival, m.won]).toEqual(['줏대', '꼬드김', false])
    // 줏대 10이라도 처음엔 20%는 버틴다
    expect(m.start).toBe(20)
  })

  it('막대는 지는 쪽으로 먼저 기울었다가 이긴 쪽 끝까지 밀린다', () => {
    const win = tugSteps(matchupFor(outcome({}), stats))
    expect(win[1].share).toBeLessThan(win[0].share)
    expect(win.at(-1)?.share).toBe(100)
    const lose = tugSteps(
      matchupFor(
        outcome({
          actual: 'HOLD',
          deviations: [{ statCode: 'courage', from: 'BUY', to: 'HOLD' }],
        }),
        stats,
      ),
    )
    expect(lose[1].share).toBeGreaterThan(lose[0].share)
    expect(lose.at(-1)?.share).toBe(0)
    expect(win.map((s) => s.at)).toEqual([...win.map((s) => s.at)].sort((a, b) => a - b))
  })
})
