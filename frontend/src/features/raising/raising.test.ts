import { describe, expect, it } from 'vitest'
import type { Run, RunOutcome } from '../../api/client'
import { LADDER, ladderTone } from './grades'
import { matchupOf } from './RunOutcomeCard'

const run = { grades: { courage: 'E', patience: 'SSS', conviction: 'B' } } as unknown as Run

function outcome(chosen: string, actual: string, statCode?: string): RunOutcome {
  return {
    kind: 'NEWS',
    chosen,
    actual,
    flips: statCode ? [{ statCode, from: chosen, to: actual }] : [],
    lines: [],
    growth: [],
  }
}

describe('결과 앞의 맞대결', () => {
  it('크게 사려다 손이 떨려 조금 샀으면 용기 vs 망설임으로 지고, 상대는 조금 산다', () => {
    const m = matchupOf(outcome('BUY_BIG', 'BUY_SMALL', 'courage'), run)
    expect(m.won).toBe(false)
    expect(m.mine).toEqual({ action: '크게 산다', trait: '용기' })
    expect(m.rival).toEqual({ action: '조금 산다', trait: '망설임' })
    // 화면에 숫자가 없어 등급 띠의 가운데에서 시작하고, 뻔해 보이지 않게 20~80% 안에 둔다.
    expect(m.start).toBe(25)
  })

  it('지켜보다 못 참고 팔았으면 인내심 vs 조급함이다', () => {
    const m = matchupOf(outcome('HOLD', 'SELL', 'patience'), run)
    expect(m.mine.trait).toBe('인내심')
    expect(m.rival.action).toBe('판다')
    expect(m.start).toBe(80)
  })

  it('뒤집히지 않았으면 이기고, 지켜보기의 상대는 꼬드김에 넘어가 조금 사는 것이다', () => {
    const m = matchupOf(outcome('HOLD', 'HOLD'), run)
    expect(m.won).toBe(true)
    expect(m.mine.trait).toBe('줏대')
    expect(m.rival.action).toBe('조금 산다')
  })
})

describe('등급 사다리', () => {
  it('15단계이고 X는 파란색, Z는 금색이다', () => {
    expect(LADDER).toHaveLength(15)
    expect(LADDER.indexOf('X')).toBe(LADDER.indexOf('SSS') + 1)
    expect(ladderTone('SSS')).not.toMatch(/down|gold/)
    expect(ladderTone('XX')).toContain('bg-down')
    expect(ladderTone('ZZZ')).toContain('bg-gold')
  })
})
