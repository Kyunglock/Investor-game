import { describe, expect, it } from 'vitest'
import { assaultBonusPercent, BUY_WALL, BuyWall } from './buyWall'

describe('매수벽', () => {
  it('붕괴하면 80px 후퇴하고 1.5초 뒤 재건하며 그 뒤 1초간 보호한다', () => {
    const wall = new BuyWall(100)
    expect(wall.hit(10)).toBe(false)
    expect(wall.hp).toBe(15)
    expect(wall.hit(20)).toBe(true)
    expect(wall.active).toBe(false)
    expect(wall.hp).toBe(0)
    expect(wall.rebuildLeft).toBe(1.5)
    expect(wall.hit(100)).toBe(false)
    expect(wall.breaks).toBe(1)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.step(0.79).rebuilt).toBe(false)
    expect(wall.active).toBe(false)
    expect(wall.step(0.02).rebuilt).toBe(true)
    expect(wall.hp).toBe(wall.maxHp)
    expect(wall.hit(100)).toBe(false)
    wall.step(1)
    expect(wall.hit(100)).toBe(true)
    expect(wall.breaks).toBe(2)
  })
  it('매수 주문은 불규칙한 간격으로 하나씩 발사하고 총량을 보존한다', () => {
    let roll = 0
    const wall = new BuyWall(100, () => (roll++ % 2 === 0 ? 0 : 1))
    expect(wall.step(10).fireCount).toBe(0)
    wall.sells = 3
    expect(wall.step(0).fireCount).toBe(0)
    expect(wall.step(0.16).fireCount).toBe(1)
    expect(wall.step(0.3).fireCount).toBe(0)
    expect(wall.step(0.26).fireCount).toBe(1)
    expect(wall.step(0.16).fireCount).toBe(1)
    expect(wall.shots).toBe(wall.sells)
    expect(wall.step(10).fireCount).toBe(0)
  })
  it('재건 후 밀린 주문도 한 발씩 보낸다', () => {
    const wall = new BuyWall(100, () => 0.5)
    wall.sells = 8
    wall.hit(100)
    expect(wall.step(1).fireCount).toBe(0)
    expect(wall.step(0.5).fireCount).toBe(0)
    expect(wall.step(0.34).fireCount).toBe(0)
    expect(wall.step(0.02).fireCount).toBe(1)
    for (let i = 0; i < 7; i++) expect(wall.step(0.36).fireCount).toBe(1)
    expect(wall.shots).toBe(wall.sells)
  })
  it('실패는 추가 0%, 클리어는 부순 매도벽당 2%다', () => {
    expect(assaultBonusPercent(false, 9)).toBe(0)
    expect(assaultBonusPercent(false, 10)).toBe(0)
    expect(assaultBonusPercent(true, 5)).toBe(10)
    expect(assaultBonusPercent(true, 10)).toBe(20)
  })
})
