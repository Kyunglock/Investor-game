import { describe, expect, it } from 'vitest'
import { clashMs, clashSwings, type DebateLine, debateTimes, teamClashMs } from './TeamClash'

describe('"너희가 알아서 해" 맞붙는 장면 (decisions.md 284번)', () => {
  it('경계선이 좌우로 크게 엎치락뒤치락하다가 이길 쪽으로 쏠린다', () => {
    const swings = clashSwings(45, 65, false)
    expect(swings.length).toBeGreaterThanOrEqual(8)
    for (const s of swings) {
      expect(s).toBeGreaterThanOrEqual(12)
      expect(s).toBeLessThanOrEqual(88)
    }
    // 처음 두 번은 서로 반대쪽으로 크게 밀린다.
    expect(Math.sign(swings[0] - 50)).not.toBe(Math.sign(swings[1] - 50))
    expect(Math.abs(swings[0] - swings[1])).toBeGreaterThan(25)
    // 끝 무렵에는 매도(이긴 쪽, 매수 몫이 작다)로 기운다.
    const tail = swings.slice(-2)
    expect((tail[0] + tail[1]) / 2).toBeLessThan(50)
    const buyWin = clashSwings(80, 20, true).slice(-2)
    expect((buyWin[0] + buyWin[1]) / 2).toBeGreaterThan(50)
  })
})

describe('"너희가 알아서 해" 토론 (decisions.md 285번)', () => {
  const talk = (side: 'BUY' | 'SELL', last = false): DebateLine => ({
    name: side === 'BUY' ? '김매수' : '박매도',
    side,
    text: '…',
    last,
  })
  const debate = [
    talk('BUY'),
    talk('SELL'),
    talk('BUY'),
    talk('SELL'),
    talk('BUY'),
    talk('SELL'),
    talk('SELL', true),
    talk('BUY', true),
  ]

  it('말이 한 줄씩 차례로 올라오고, 결판은 말이 다 오간 뒤에 난다', () => {
    const times = debateTimes(debate)
    expect(times.slice(0, 6)).toEqual([0, 1000, 2000, 3000, 4000, 5000])
    // 이긴 쪽 결판은 맞붙기가 끝날 때, 진 쪽 투덜거림은 그 뒤에.
    expect(times[6]).toBe(clashMs(debate))
    expect(times[7]).toBeGreaterThan(times[6])
    expect(clashMs(debate)).toBeGreaterThan(times[5])
    // 회의 연출은 투덜거림까지 다 본 뒤에 시작한다.
    expect(teamClashMs(debate)).toBeGreaterThan(times[7])
  })

  it('토론이 없으면(옛 회의) 짧게 맞붙기만 한다', () => {
    expect(debateTimes([])).toEqual([])
    expect(teamClashMs([])).toBe(clashMs([]) + 800)
    expect(clashSwings(50, 50, true, clashMs(debate)).length).toBeGreaterThan(
      clashSwings(50, 50, true).length,
    )
  })
})
