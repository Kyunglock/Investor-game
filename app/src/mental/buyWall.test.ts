import { describe, expect, it } from 'vitest'
import { assaultBonusPercent, BUY_WALL, BuyWall } from './buyWall'

describe('매수벽', () => {
  it('물량을 받아내고 붕괴는 한 번만 발생하며 뒤로 밀린 뒤 재정비한다', () => {
    const wall = new BuyWall(100)
    expect(wall.hit(10)).toBe(false)
    expect(wall.hp).toBe(15)
    expect(wall.hit(20)).toBe(true)
    expect(wall.hit(20)).toBe(false)
    expect(wall.breaks).toBe(1)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.push).toBeGreaterThan(0)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.active).toBe(false)
    expect(wall.step(3.3).rebuilt).toBe(true)
    expect(wall.hp).toBe(wall.maxHp)
  })
  it('매수 발사는 매도 물량의 5분의 1 이하이며 몰아서 발사하지 않는다', () => {
    const wall = new BuyWall(100)
    expect(wall.step(10).fire).toBe(false)
    wall.sells = 100
    for (let i = 0; i < 100; i++) wall.step(3)
    expect(wall.shots).toBe(20)
    wall.sells += 5
    expect(wall.step(3).fire).toBe(true)
    expect(wall.step(0).fire).toBe(false)
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
