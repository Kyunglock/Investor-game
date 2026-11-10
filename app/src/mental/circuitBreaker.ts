/** 중간 매도벽과 중간 보스를 넘긴 뒤 한 번만 거래를 잠깐 멈추고 숨을 고른다. */
export const CIRCUIT_BREAKER = {
  afterWalls: [5] as readonly number[],
  seconds: 4,
  healRatio: 0.2,
  pieces: 24,
  assembleUntil: 0.8,
  /** 거래 정지 동안 대기 줄에 쌓이는 주문: 매도는 sellEvery초, 매수는 buyEvery초마다 하나. 매도가 훨씬 많다(약 30 : 10). */
  sellEvery: 0.12,
  buyEvery: 0.35,
  /** 정지가 끝나기 이 초 전부터는 새 주문을 더 쌓지 않는다. */
  stopBefore: 0.4,
}

/** 거래 정지 한 번에 쌓이는 매도·매수 대기 주문 수(대략). */
export function circuitQueueCounts() {
  const open = CIRCUIT_BREAKER.seconds - CIRCUIT_BREAKER.stopBefore
  return {
    sells: Math.floor(open / CIRCUIT_BREAKER.sellEvery),
    buys: Math.floor(open / CIRCUIT_BREAKER.buyEvery),
  }
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
  get assembled() {
    return Math.min(CIRCUIT_BREAKER.pieces, Math.floor(this.formation * CIRCUIT_BREAKER.pieces))
  }
  get formation() {
    return Math.min(1, this.progress / CIRCUIT_BREAKER.assembleUntil)
  }
  get reveal() {
    return Math.max(
      0,
      (this.progress - CIRCUIT_BREAKER.assembleUntil) / (1 - CIRCUIT_BREAKER.assembleUntil),
    )
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
