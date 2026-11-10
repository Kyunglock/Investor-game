/** 중간 매도벽과 중간 보스를 넘긴 뒤 한 번만 거래를 잠깐 멈추고 숨을 고른다. */
export const CIRCUIT_BREAKER = {
  afterWalls: [5] as readonly number[],
  seconds: 3.6,
  healRatio: 0.2,
  orders: 6,
  sharesPerOrder: 300,
}

/** 전투 시계와 별개로 흐른다. 카드·나가기 창에서는 step을 호출하지 않는다. */
export class CircuitBreaker {
  elapsed = 0
  readonly recovery: number
  constructor(mental: number, maxMental: number) {
    this.recovery = Math.max(0, Math.min(maxMental - mental, maxMental * CIRCUIT_BREAKER.healRatio))
  }
  get progress() {
    return Math.min(1, this.elapsed / CIRCUIT_BREAKER.seconds)
  }
  get queued() {
    return Math.min(CIRCUIT_BREAKER.orders, Math.floor(this.progress * CIRCUIT_BREAKER.orders))
  }
  get done() {
    return this.progress >= 1
  }
  /** 이번 프레임에 회복할 실제 멘탈. */
  step(dt: number) {
    const before = this.progress
    this.elapsed = Math.min(CIRCUIT_BREAKER.seconds, this.elapsed + Math.max(0, dt))
    return this.recovery * (this.progress - before)
  }
}
