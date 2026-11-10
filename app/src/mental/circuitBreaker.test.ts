import { describe, expect, it } from 'vitest'
import { CIRCUIT_BREAKER, CircuitBreaker } from './circuitBreaker'

describe('서킷브레이커', () => {
  it('중간 벽 이후 한 번만 예약한다', () => {
    expect(CIRCUIT_BREAKER.afterWalls).toEqual([5])
  })
  it('4초 동안 멘탈 20%를 회복하고 벽 조립 후 거래를 재개한다', () => {
    const c = new CircuitBreaker(100, 200)
    expect(c.step(2)).toBeCloseTo(20)
    expect(c.assembled).toBe(15)
    expect(c.done).toBe(false)
    expect(c.step(1.2)).toBeCloseTo(12)
    expect(c.assembled).toBe(CIRCUIT_BREAKER.pieces)
    expect(c.done).toBe(false)
    expect(c.step(0.8)).toBeCloseTo(8)
    expect(c.elapsed).toBe(4)
    expect(c.done).toBe(true)
    expect(c.formation).toBe(1)
    expect(c.reveal).toBeCloseTo(1)
    expect(c.step(10)).toBe(0)
  })
  it('멘탈 상한을 넘지 않고 가득 차 있어도 물량은 쌓인다', () => {
    expect(new CircuitBreaker(95, 100).step(4)).toBe(5)
    const c = new CircuitBreaker(100, 100)
    expect(c.step(4)).toBe(0)
    expect(c.assembled).toBe(24)
  })
  it('호출하지 않는 일시정지 동안 진행하지 않고 음수 시간도 무시한다', () => {
    const c = new CircuitBreaker(50, 100)
    c.step(1)
    const before = c.progress
    expect(c.step(-2)).toBe(0)
    expect(c.progress).toBe(before)
  })
})
