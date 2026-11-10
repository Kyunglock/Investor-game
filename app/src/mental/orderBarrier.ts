export interface BarrierLane {
  left: number
  width: number
  y: number
}

/** 주문 객체를 유지하면서 차단벽 양쪽의 칸에 줄 세운다. */
export class OrderBarrierQueue {
  private slots = new Map<object, { column: number; row: number }>()
  private rows = new Map<number, number>()
  clear() {
    this.slots.clear()
    this.rows.clear()
  }
  get size() {
    return this.slots.size
  }
  move(order: { x: number; y: number }, dt: number, lane: BarrierLane, side: 'buy' | 'sell') {
    const sign = side === 'buy' ? 1 : -1
    // 발동 전에 이미 반대편으로 통과한 주문은 그 자리에서 정지한다.
    if (!this.slots.has(order) && (order.y - lane.y) * sign < -34) return
    const cols = Math.max(1, Math.floor(lane.width / 48))
    let slot = this.slots.get(order)
    if (!slot) {
      const column = Math.max(
        0,
        Math.min(cols - 1, Math.floor((order.x - lane.left) / (lane.width / cols))),
      )
      const row = this.rows.get(column) ?? 0
      slot = { column, row }
      this.slots.set(order, slot)
      this.rows.set(column, row + 1)
    }
    const x = lane.left + ((Math.min(cols - 1, slot.column) + 0.5) * lane.width) / cols
    const y = lane.y + sign * (54 + slot.row * 28)
    const approach = (from: number, to: number) =>
      from + Math.max(-180 * dt, Math.min(180 * dt, to - from))
    order.x = approach(order.x, x)
    order.y = approach(order.y, y)
  }
}
