import { describe, expect, it } from 'vitest'
import { assaultBonusPercent, BUY_WALL, BuyWall } from './buyWall'

describe('매수벽', () => {
  it('붕괴 즉시 새 벽을 세우고 1초 동안 연속 붕괴를 막는다', () => {
    const wall = new BuyWall(100)
    expect(wall.hit(10)).toBe(false)
    expect(wall.hp).toBe(15)
    expect(wall.hit(20)).toBe(true)
    expect(wall.active).toBe(true)
    expect(wall.hp).toBe(wall.maxHp)
    expect(wall.rebuildLeft).toBe(0)
    expect(wall.hit(20)).toBe(false)
    expect(wall.breaks).toBe(1)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.push).toBeGreaterThan(0)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.active).toBe(true)
    expect(wall.hit(100)).toBe(false)
    wall.step(0.31)
    expect(wall.hit(100)).toBe(true)
    expect(wall.breaks).toBe(2)
    expect(wall.step(0).rebuilt).toBe(true)
    expect(wall.step(0).rebuilt).toBe(false)
    expect(wall.hp).toBe(wall.maxHp)
  })
  it('매수 지원은 1.8초마다 매도 물량 세 개당 한 발씩 나오며 몰아서 발사하지 않는다', () => {
    const wall = new BuyWall(100)
    expect(wall.step(10).fire).toBe(false)
    wall.sells = 99
    for (let i = 0; i < 100; i++) wall.step(3)
    expect(wall.shots).toBe(33)
    wall.sells += 3
    expect(wall.step(3).fire).toBe(true)
    expect(wall.step(0).fire).toBe(false)
    wall.sells += 3
    expect(wall.step(1.7).fire).toBe(false)
    expect(wall.step(0.1).fire).toBe(true)
    wall.hit(100)
    expect(wall.step(1).fire).toBe(false)
  })
  it('실패는 추가 0%, 클리어는 부순 매도벽당 2%다', () => {
    expect(assaultBonusPercent(false, 9)).toBe(0)
    expect(assaultBonusPercent(false, 10)).toBe(0)
    expect(assaultBonusPercent(true, 5)).toBe(10)
    expect(assaultBonusPercent(true, 10)).toBe(20)
  })
})
