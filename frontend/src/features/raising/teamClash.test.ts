import { describe, expect, it } from 'vitest'
import {
  clashMs,
  type DebateLine,
  debateTimes,
  roomShare,
  sidePeople,
  teamClashMs,
} from './TeamClash'

describe('"너희가 알아서 해" 회의실 (decisions.md 286번)', () => {
  it('방은 양쪽 사람 수 비율대로 나뉘고, 한 사람뿐인 쪽도 앉을 자리가 있다', () => {
    expect(roomShare(2, 2)).toBe(50)
    expect(roomShare(3, 1)).toBe(75)
    expect(roomShare(1, 2)).toBe(33)
    expect(roomShare(9, 1)).toBe(78)
    expect(roomShare(1, 9)).toBe(22)
    expect(roomShare(0, 0)).toBe(50)
  })

  it('의견을 낸 사람이 없는 쪽에는 토론에 끌려 나온 사람이 앉는다', () => {
    const debate: DebateLine[] = [
      { name: '김매수', side: 'BUY', text: '…', last: false },
      { name: '옆자리 신입', side: 'SELL', text: '…', last: false },
      { name: '옆자리 신입', side: 'SELL', text: '…', last: true },
    ]
    expect(sidePeople(['김매수', '이매수'], 'BUY', debate)).toEqual(['김매수', '이매수'])
    expect(sidePeople([], 'SELL', debate)).toEqual(['옆자리 신입'])
    expect(sidePeople([], 'SELL', [])).toEqual([])
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
    expect(clashMs(debate)).toBeGreaterThan(clashMs([]))
  })
})
