import { describe, expect, it } from 'vitest'
import { assaultSpec } from './assault'
import { crossOrders, ORDERS, orderHp, orderShares, quantityOrder } from './enemies'
import { SHARES_PER_HP } from './shares'

describe('스테이지별 매도 티켓 물량', () => {
  it('첫 스테이지의 매도 주문은 100주로 시작하고 이후 체력 배율과 함께 증가한다', () => {
    expect(orderShares('order', assaultSpec(1).enemyHp)).toBe(100)
    expect(orderShares('order', assaultSpec(2).enemyHp)).toBe(130)
    expect(orderShares('order', assaultSpec(11).enemyHp)).toBe(400)
    for (const kind of ['order', 'market', 'bulk', 'fake'] as const) {
      const base = ORDERS[kind].shares
      expect(orderShares(kind, assaultSpec(1).enemyHp)).toBe(base)
      expect(orderShares(kind, assaultSpec(2).enemyHp)).toBe(Math.round(base * 1.3))
      expect(orderShares(kind, assaultSpec(11).enemyHp)).toBe(base * 4)
    }
  })

  it('높은 스테이지에서도 물량은 양의 정수이며 계속 증가한다', () => {
    for (const kind of ['order', 'market', 'bulk', 'fake'] as const) {
      let previous = 0
      for (let level = 1; level <= 100; level++) {
        const shares = orderShares(kind, assaultSpec(level).enemyHp)
        expect(Number.isInteger(shares)).toBe(true)
        expect(shares).toBeGreaterThan(previous)
        previous = shares
      }
    }
  })
})

describe('수량이 곧 체력이자 공격', () => {
  it('매도 주문·시장가·대량 매도의 체력은 화면 수량 ÷ SHARES_PER_HP다', () => {
    expect(orderHp('order', 1) * SHARES_PER_HP).toBeCloseTo(orderShares('order', 1))
    expect(orderHp('market', 2) * SHARES_PER_HP).toBeCloseTo(orderShares('market', 2))
    expect(orderHp('bulk', 1.3) * SHARES_PER_HP).toBeCloseTo(orderShares('bulk', 1.3))
    expect(quantityOrder('order')).toBe(true)
    expect(quantityOrder('fake')).toBe(false)
    expect(quantityOrder('cell')).toBe(false)
    expect(quantityOrder('panic')).toBe(false)
  })

  it('매수와 매도는 서로 적은 쪽만큼 상쇄하고 남은 매수는 계속 간다', () => {
    expect(crossOrders(3, 1)).toEqual({ used: 1, left: 2 })
    expect(crossOrders(1, 3)).toEqual({ used: 1, left: 0 })
    expect(crossOrders(2, 2)).toEqual({ used: 2, left: 0 })
    expect(crossOrders(2, 0)).toEqual({ used: 0, left: 2 })
  })
})
