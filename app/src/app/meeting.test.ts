import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { clock, hasTrader, meetingReady, meetingState, secondsLeft } from './meeting'

function company(over: Partial<Company> = {}): Company {
  return {
    desks: [
      { code: 'bio', trades: true },
      { code: 'research', trades: false },
    ],
    employees: [{ id: 1, desk: 'bio' }],
    meetings: { chances: 1, max: 3, nextSeconds: 600 },
    invest: null,
    ...over,
  } as unknown as Company
}

describe('종목회의 칸 (#803)', () => {
  it('돈을 굴리는 자리에 앉은 사람만 센다', () => {
    expect(hasTrader(company())).toBe(true)
    expect(hasTrader(company({ employees: [{ id: 1, desk: 'research' }] as never }))).toBe(false)
    expect(hasTrader(company({ employees: [{ id: 1, desk: null }] as never }))).toBe(false)
  })

  it('정하지 않은 회의가 있으면 이어서, 기회가 있으면 열기, 없으면 기다리기', () => {
    expect(meetingState(company())).toBe('open')
    expect(meetingState(company({ meetings: { chances: 0, max: 3, nextSeconds: 10 } }))).toBe(
      'wait',
    )
    const pending = { convened: true, outcome: null } as never
    expect(meetingState(company({ invest: pending }))).toBe('continue')
    // 정한 회의는 결과로 남아 있을 뿐이라 새로 여는 상태다.
    const decided = { convened: true, outcome: { total: 1 } } as never
    expect(meetingState(company({ invest: decided }))).toBe('open')
  })

  it('돈을 굴리는 자리가 비면 열 수 없고, 열어 둔 회의는 그래도 이어 간다', () => {
    const empty = { employees: [] as never }
    expect(meetingState(company(empty))).toBe('nodesk')
    const pending = { convened: true, outcome: null } as never
    expect(meetingState(company({ ...empty, invest: pending }))).toBe('continue')
  })

  it('표는 열거나 이어 갈 수 있고 돈을 굴리는 사람이 있을 때만 단다', () => {
    expect(meetingReady(company())).toBe(true)
    expect(meetingReady(company({ meetings: { chances: 0, max: 3, nextSeconds: 10 } }))).toBe(false)
    const pending = { convened: true, outcome: null } as never
    expect(
      meetingReady(company({ invest: pending, meetings: { chances: 0, max: 3, nextSeconds: 1 } })),
    ).toBe(true)
    expect(meetingReady(company({ employees: [] as never }))).toBe(false)
    expect(meetingReady(company({ employees: [] as never, invest: pending }))).toBe(false)
  })

  it('남은 시간은 받은 때부터 흐른 만큼 줄고 0에서 멈춘다', () => {
    expect(secondsLeft(600, 0)).toBe(600)
    expect(secondsLeft(600, 1500)).toBe(599)
    expect(secondsLeft(5, 60_000)).toBe(0)
    expect(secondsLeft(0, 0)).toBe(0)
    expect(clock(599)).toBe('9:59')
    expect(clock(0)).toBe('0:00')
    expect(clock(3600)).toBe('1:00:00')
  })
})
