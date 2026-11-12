/** 매수 주문이 위로 날아가는 빠르기(px/초). 매도 물량도 같은 빠르기로 내려온다(대량 매도만 느리게). */
export const BUY_ORDER_SPEED = 360

export const BUY_WALL = {
  hpRatio: 0.25,
  mentalLossRatio: 0.12,
  rebuildSeconds: 1.5,
  protectionSeconds: 1,
  shotSeconds: 0.35,
  shotJitter: 0.2,
  shotsPerSell: 2,
  retreatSeconds: 0.7,
  retreatDistance: 80,
} as const

/** 매수 티켓은 양쪽에 40%씩, 가운데에 20%. 각 영역 안에서도 위치를 무작위로 정한다. */
export function buyOrderX(left: number, width: number, random: () => number = Math.random) {
  const r = random()
  const position =
    r < 0.4
      ? 0.08 + (r / 0.4) * 0.24
      : r < 0.8
        ? 0.68 + ((r - 0.4) / 0.4) * 0.24
        : 0.32 + ((r - 0.8) / 0.2) * 0.36
  return left + width * position
}

/**
 * 매수벽이 무너질 때 뒤로 밀리는 적인가 (#699): 화면 세로 중간선을 넘어 매수벽 쪽(아래)으로 내려온 적만 민다. 중간선 위쪽의 아직 먼 적은
 * 그대로 둔다.
 */
export function pushedByCollapse(y: number, viewHeight: number): boolean {
  return y >= viewHeight / 2
}

/** 매도 물량 하나당 매수 주문 두 개로 맞선다. 붕괴하면 후퇴하고 1.5초 뒤 새 벽을 세운다. */
export class BuyWall {
  readonly maxHp: number
  hp: number
  rebuildLeft = 0
  retreatLeft = 0
  sells = 0
  shots = 0
  breaks = 0
  private shotClock = 0
  private nextShot: number
  private readonly random: () => number
  private protectionLeft = 0
  constructor(maxMental: number, random: () => number = Math.random) {
    this.random = random
    this.nextShot = this.shotDelay()
    this.maxHp = Math.max(1, Math.round(maxMental * BUY_WALL.hpRatio))
    this.hp = this.maxHp
  }
  private shotDelay() {
    return BUY_WALL.shotSeconds + (this.random() * 2 - 1) * BUY_WALL.shotJitter
  }
  get active() {
    return this.hp > 0
  }
  get push() {
    return this.retreatLeft > 0
      ? Math.sin((1 - this.retreatLeft / BUY_WALL.retreatSeconds) * Math.PI) * 28
      : 0
  }
  hit(damage: number): boolean {
    if (!this.active || this.protectionLeft > 0) return false
    this.hp = Math.max(0, this.hp - Math.max(0, damage))
    if (this.hp > 0) return false
    this.breaks++
    this.rebuildLeft = BUY_WALL.rebuildSeconds
    this.retreatLeft = BUY_WALL.retreatSeconds
    this.shotClock = 0
    this.nextShot = this.shotDelay()
    return true
  }
  step(dt: number): { retreat: number; fire: boolean; fireCount: number; rebuilt: boolean } {
    const time = Math.max(0, dt)
    this.protectionLeft = Math.max(0, this.protectionLeft - time)
    const retreat =
      (Math.min(time, this.retreatLeft) * BUY_WALL.retreatDistance) / BUY_WALL.retreatSeconds
    this.retreatLeft = Math.max(0, this.retreatLeft - time)
    if (!this.active) {
      this.rebuildLeft = Math.max(0, this.rebuildLeft - time)
      if (this.rebuildLeft === 0) {
        this.hp = this.maxHp
        this.protectionLeft = BUY_WALL.protectionSeconds
      }
      return { retreat, fire: false, fireCount: 0, rebuilt: this.active }
    }
    const fireCount = this.stepOrders(time)
    return { retreat, fire: fireCount > 0, fireCount, rebuilt: false }
  }
  /** 거래 정지 중에는 재건·보호 시계와 별도로 주문 발사만 느리게 진행한다. */
  stepOrders(dt: number): number {
    if (!this.active) return 0
    const pending = Math.max(0, Math.floor(this.sells) * BUY_WALL.shotsPerSell - this.shots)
    // 쉬는 시간을 모아 두거나 밀린 주문을 한 프레임에 모두 쏘지 않는다. 한 번에 두 장씩 보낸다.
    this.shotClock = pending > 0 ? this.shotClock + Math.max(0, dt) : 0
    const fireCount =
      pending > 0 && this.shotClock >= this.nextShot ? Math.min(pending, BUY_WALL.shotsPerSell) : 0
    if (fireCount > 0) {
      this.shots += fireCount
      this.shotClock = 0
      this.nextShot = this.shotDelay()
    }
    return fireCount
  }
}

/** 매도벽 돌파 추가 수익(%): 별 1·2·3개 → 25·50·100%. 별이 없으면 0%. */
export const ASSAULT_STAR_BONUS = [0, 25, 50, 100] as const

/** 광고를 보면 받을 수 있는 매도벽 돌파 추가 수익(%). 지금은 버튼만 있다. */
export const ASSAULT_AD_BONUS = 400

export function assaultBonusPercent(stars: number): number {
  return ASSAULT_STAR_BONUS[Math.min(3, Math.max(0, Math.floor(stars)))]
}
