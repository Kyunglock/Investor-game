import { describe, expect, it } from 'vitest'
import { assaultSpec } from './assault'
import { ORDERS, orderShares } from './enemies'

describe('스테이지별 매도 티켓 물량', () => {
  it('첫 스테이지는 기존 물량을 유지하고 이후 체력 배율과 함께 증가한다', () => {
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
