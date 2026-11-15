import { describe, expect, it } from 'vitest'
import { type Attendance, cellAmount, cellState, rewardText, shouldAutoOpen } from './attendance'

const board = (claimed: number): Attendance['board'] =>
  [50, 0, 100, 0, 100, 100, 300].map((diamonds, i) => ({
    day: i + 1,
    diamonds,
    incomeMinutes: diamonds === 0 ? 30 : 0,
    money: diamonds === 0 ? 3_500_000 : null,
    claimed: i < claimed,
  }))
const attendance = (today: number, claimable: boolean): Attendance => ({
  today,
  claimable,
  board: board(claimable ? today - 1 : today),
  lastReward: null,
})

describe('출석 보상 (528번)', () => {
  it('받은 보상을 한 줄로 적는다', () => {
    expect(rewardText({ diamonds: 50, money: 0 })).toBe('다이아 50개')
    expect(rewardText({ diamonds: 0, money: 3_500_000 })).toBe('돈 3.5b')
    expect(rewardText({ diamonds: 300, money: 1200 })).toBe('다이아 300개 · 돈 1.2a')
  })

  it('칸에는 다이아 수나 지금 받을 돈을 적는다', () => {
    const cells = board(0)
    expect(cellAmount(cells[0])).toBe('50')
    expect(cellAmount(cells[1])).toBe('3.5b')
    expect(cellAmount({ ...cells[1], money: null })).toBe('0')
  })

  it('받은 칸·오늘 칸·남은 칸을 가린다', () => {
    const open = attendance(3, true)
    expect(open.board.map((cell) => cellState(open, cell))).toEqual([
      'done',
      'done',
      'today',
      'later',
      'later',
      'later',
      'later',
    ])
    // 오늘 이미 받았으면 오늘 칸도 받은 칸이고, 강조할 칸이 없다.
    const taken = attendance(3, false)
    expect(taken.board.map((cell) => cellState(taken, cell))).toEqual([
      'done',
      'done',
      'done',
      'later',
      'later',
      'later',
      'later',
    ])
  })

  it('안 받은 날에만 스스로 뜨고, 닫은 칸은 다시 띄우지 않는다', () => {
    expect(shouldAutoOpen(attendance(1, true), null)).toBe(true)
    expect(shouldAutoOpen(attendance(1, false), null)).toBe(false)
    expect(shouldAutoOpen(attendance(4, true), 4)).toBe(false)
    // 다음 날 칸이 바뀌면 다시 뜬다.
    expect(shouldAutoOpen(attendance(5, true), 4)).toBe(true)
  })
})
