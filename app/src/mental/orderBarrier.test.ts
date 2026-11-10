import { expect, it } from 'vitest'
import { OrderBarrierQueue } from './orderBarrier'

const lane = { left: 20, width: 300, y: 400 }
it('양쪽 주문을 차단벽 앞에 쌓고 대기 중 객체와 물량을 보존한다', () => {
  for (const side of ['buy', 'sell'] as const) {
    const queue = new OrderBarrierQueue()
    const orders = Array.from({ length: 3 }, () => ({ x: 100, y: side === 'buy' ? 650 : 150 }))
    for (let frame = 0; frame < 240; frame++)
      for (const order of orders) queue.move(order, 1 / 60, lane, side)
    expect(queue.size).toBe(3)
    expect(new Set(orders.map((o) => o.y)).size).toBe(3)
    expect(orders.every((o) => (side === 'buy' ? o.y >= 454 : o.y <= 346))).toBe(true)
    const snapshot = structuredClone(orders)
    for (const order of orders) queue.move(order, 1, lane, side)
    expect(orders).toEqual(snapshot)
    queue.clear()
    expect(queue.size).toBe(0)
    expect(orders).toEqual(snapshot)
  }
})
it('발동 전에 반대편으로 지나간 주문을 되돌리지 않는다', () => {
  const queue = new OrderBarrierQueue()
  const sell = { x: 100, y: 500 }
  queue.move(sell, 1, lane, 'sell')
  expect(sell).toEqual({ x: 100, y: 500 })
  expect(queue.size).toBe(0)
})
