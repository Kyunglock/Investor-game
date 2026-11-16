import { describe, expect, it } from 'vitest'
import { type Attendance, receivedText, shouldClaim } from './attendance'

const attendance = (claimable: boolean): Attendance => ({
  today: 3,
  claimable,
  board: [50, 50, 100, 50, 100, 100, 300].map((diamonds, i) => ({
    day: i + 1,
    diamonds,
    incomeMinutes: 0,
    money: null,
    claimed: i < (claimable ? 2 : 3),
  })),
  lastReward: null,
})

describe('출석 보상 (528·564번)', () => {
  it('오늘 것을 아직 안 받았으면 들어오자마자 받는다', () => {
    expect(shouldClaim(attendance(true), false)).toBe(true)
    expect(shouldClaim(attendance(false), false)).toBe(false)
  })

  it('다른 창이 떠 있으면 그 뒤로 미룬다', () => {
    expect(shouldClaim(attendance(true), true)).toBe(false)
  })

  it('받은 것을 한 줄로 알린다', () => {
    expect(receivedText({ day: 3, diamonds: 100 })).toBe('출석 3일차 · 다이아 100개 받았어요')
    expect(receivedText({ day: 7, diamonds: 1500 })).toBe('출석 7일차 · 다이아 1,500개 받았어요')
  })
})
