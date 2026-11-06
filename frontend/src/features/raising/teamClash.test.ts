import { describe, expect, it } from 'vitest'
import {
  clashMs,
  type DebateLine,
  debateTimes,
  doneAt,
  gaugeDone,
  gaugeDuring,
  lineMs,
  roomShare,
  sidePeople,
  teamClashMs,
} from './TeamClash'

describe('"너희가 알아서 해" 저울 (decisions.md 291번)', () => {
  const line = (side: 'BUY' | 'SELL', last = false): DebateLine => ({
    name: side,
    side,
    text: '…',
    last,
  })

  it('토론 중에는 말 한마디마다 말한 쪽으로 조금씩 기울고 크게 기울지는 않는다', () => {
    const debate = [line('BUY'), line('BUY'), line('SELL'), line('BUY'), line('BUY', true)]
    expect(gaugeDuring(debate, 0)).toBe(50)
    expect(gaugeDuring(debate, 1)).toBe(54)
    expect(gaugeDuring(debate, 2)).toBe(58)
    expect(gaugeDuring(debate, 3)).toBe(54)
    // 결판 말은 세지 않는다.
    expect(gaugeDuring(debate, 5)).toBe(gaugeDuring(debate, 4))
    expect(gaugeDuring(Array(10).fill(line('BUY')), 10)).toBe(64)
    expect(gaugeDuring(Array(10).fill(line('SELL')), 10)).toBe(36)
  })

  it('결판이 나면 무게 비율대로, 다만 이긴 쪽이 68~88%를 차지한다', () => {
    expect(gaugeDone(80, 20, true)).toBe(80)
    expect(gaugeDone(20, 80, false)).toBe(20)
    expect(gaugeDone(51, 49, true)).toBe(68)
    expect(gaugeDone(49, 51, false)).toBe(32)
    expect(gaugeDone(99, 1, true)).toBe(88)
    expect(gaugeDone(0, 0, true)).toBe(70)
    expect(gaugeDone(0, 0, false)).toBe(30)
    // 무게는 매수가 큰데 서버가 매도로 정했어도(확률) 이긴 쪽으로 기운다.
    expect(gaugeDone(70, 30, false)).toBe(32)
  })
})

describe('"너희가 알아서 해" 회의실 (decisions.md 286번)', () => {
  it('방은 양쪽 사람 수 비율대로 나뉘고, 한 사람뿐인 쪽도 앉을 자리가 있다', () => {
    expect(roomShare(2, 2)).toBe(50)
    expect(roomShare(3, 1)).toBe(75)
    expect(roomShare(1, 2)).toBe(33)
    expect(roomShare(9, 1)).toBe(78)
    expect(roomShare(1, 9)).toBe(22)
    expect(roomShare(0, 0)).toBe(50)
  })

  it('원탁에는 토론에서 말한 사람(팀장)만 앉고, 의견을 낸 사람이 없는 쪽에는 끌려 나온 사람이 앉는다 (295번)', () => {
    const debate: DebateLine[] = [
      { name: '김매수', side: 'BUY', text: '…', last: false },
      { name: '옆자리 신입', side: 'SELL', text: '…', last: false },
      { name: '옆자리 신입', side: 'SELL', text: '…', last: true },
    ]
    expect(sidePeople(['김매수', '이매수'], 'BUY', debate)).toEqual(['김매수'])
    expect(sidePeople([], 'SELL', debate)).toEqual(['옆자리 신입'])
    expect(sidePeople(['박매도'], 'SELL', [])).toEqual(['박매도'])
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

  it('말 한 줄은 글자 수만큼 머문다: 짧아도 1.6초, 길어도 4초 (303번)', () => {
    expect(lineMs('…')).toBe(1600)
    expect(lineMs('고객사 주문이 30%나 늘어난다잖아요! 이건 무조건 사야죠!')).toBe(1200 + 33 * 45)
    expect(lineMs('가'.repeat(100))).toBe(4000)
  })

  it('말이 한 줄씩 차례로 올라오고, 결판은 말이 다 오간 뒤에 난다', () => {
    const times = debateTimes(debate)
    const one = lineMs('…')
    expect(times.slice(0, 6)).toEqual([0, one, one * 2, one * 3, one * 4, one * 5])
    // 이긴 쪽 결판은 토론이 끝날 때, 진 쪽 투덜거림은 그 뒤에.
    expect(times[6]).toBe(clashMs(debate))
    expect(times[7]).toBeGreaterThan(times[6])
    expect(clashMs(debate)).toBeGreaterThan(times[5])
    // 회의 연출은 투덜거림까지 다 본 뒤에 시작한다.
    expect(teamClashMs(debate)).toBeGreaterThan(times[7])
    expect(doneAt(debate)).toBe(times[7])
  })

  it('결판 세 박자(표결·선언·승복)는 한 박자씩 띄어 뜨고, 승복이 뜰 때 끝난다 (295번)', () => {
    const three = [
      ...debate.slice(0, 6),
      { ...talk('SELL', true), kind: 'TALLY' as const },
      { ...talk('SELL', true), kind: 'WIN' as const },
      { ...talk('BUY', true), kind: 'LOSE' as const },
    ]
    const times = debateTimes(three)
    const one = lineMs('…')
    expect(times.slice(6)).toEqual([one * 6, one * 7, one * 8])
    expect(doneAt(three)).toBe(one * 8)
    expect(teamClashMs(three)).toBe(one * 9)
  })

  it('토론이 없으면(옛 회의) 짧게 맞붙기만 한다', () => {
    expect(debateTimes([])).toEqual([])
    expect(teamClashMs([])).toBe(clashMs([]) + 800)
    expect(clashMs(debate)).toBeGreaterThan(clashMs([]))
  })
})
