import { describe, expect, it } from 'vitest'
import { assaultBonusPercent, BUY_WALL, BuyWall, pushedByCollapse } from './buyWall'

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
  it('추가 수익은 별 0·1·2·3개 → 0·25·50·100%다', () => {
    expect(assaultBonusPercent(0)).toBe(0)
    expect(assaultBonusPercent(1)).toBe(25)
    expect(assaultBonusPercent(2)).toBe(50)
    expect(assaultBonusPercent(3)).toBe(100)
  })
})

it('서킷브레이커는 발사 시계만 20%로 줄이고 총량과 재건 시간을 보존한다', () => {
  const normal = new BuyWall(100, () => 0.5)
  const halted = new BuyWall(100, () => 0.5)
  normal.sells = halted.sells = 20
  for (let i = 0; i < 240; i++) {
    normal.stepOrders(1 / 60)
    halted.stepOrders(0.2 / 60)
  }
  expect(halted.shots).toBeGreaterThan(0)
  expect(halted.shots).toBeLessThan(normal.shots)
  expect(halted.shots).toBeLessThanOrEqual(halted.sells)
  halted.hit(100)
  const rebuild = halted.rebuildLeft
  expect(halted.stepOrders(4)).toBe(0)
  expect(halted.rebuildLeft).toBe(rebuild)
})

describe('매수벽 붕괴 밀어내기 (#699)', () => {
  it('화면 중간선을 넘어온 적만 뒤로 민다', () => {
    expect(pushedByCollapse(100, 800)).toBe(false)
    expect(pushedByCollapse(399, 800)).toBe(false)
    expect(pushedByCollapse(400, 800)).toBe(true)
    expect(pushedByCollapse(700, 800)).toBe(true)
  })
})
