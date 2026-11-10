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
  it('매도 물량 하나마다 매수 주문 하나를 보내고 떼로 오면 같은 수로 맞선다', () => {
    const wall = new BuyWall(100)
    expect(wall.step(10).fireCount).toBe(0)
    wall.sells = 8
    expect(wall.step(0).fireCount).toBe(8)
    expect(wall.shots).toBe(8)
    expect(wall.step(0).fireCount).toBe(0)
    wall.sells += 5
    expect(wall.step(0.34).fireCount).toBe(0)
    expect(wall.step(0.02).fireCount).toBe(5)
    expect(wall.shots).toBe(wall.sells)
    wall.hit(100)
    wall.sells += 10
    expect(wall.step(1).fireCount).toBe(0)
    expect(wall.step(0.5).fireCount).toBe(0)
    expect(wall.step(0.35).fireCount).toBe(10)
    expect(wall.shots).toBe(wall.sells)
  })
  it('실패는 추가 0%, 클리어는 부순 매도벽당 2%다', () => {
    expect(assaultBonusPercent(false, 9)).toBe(0)
    expect(assaultBonusPercent(false, 10)).toBe(0)
    expect(assaultBonusPercent(true, 5)).toBe(10)
    expect(assaultBonusPercent(true, 10)).toBe(20)
  })
})
