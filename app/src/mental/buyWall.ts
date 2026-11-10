export const BUY_WALL = {
  hpRatio: 0.25,
  mentalLossRatio: 0.12,
  rebuildSeconds: 0,
  protectionSeconds: 1,
  shotSeconds: 1.8,
  sellsPerShot: 3,
  retreatSeconds: 0.7,
  retreatDistance: 80,
} as const

/** 매수 지원은 매도 물량 세 개당 최대 한 발. 벽이 무너지면 즉시 새 벽을 세우고 잠시 보호한다. */
export class BuyWall {
  readonly maxHp: number
  hp: number
  rebuildLeft = 0
  retreatLeft = 0
  sells = 0
  shots = 0
  breaks = 0
  private shotClock = 0
  private protectionLeft = 0
  private rebuilt = false
  constructor(maxMental: number) {
    this.maxHp = Math.max(1, Math.round(maxMental * BUY_WALL.hpRatio))
    this.hp = this.maxHp
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
    this.hp = this.maxHp
    this.protectionLeft = BUY_WALL.protectionSeconds
    this.rebuilt = true
    this.rebuildLeft = BUY_WALL.rebuildSeconds
    this.retreatLeft = BUY_WALL.retreatSeconds
    this.shotClock = 0
    return true
  }
  step(dt: number): { retreat: number; fire: boolean; rebuilt: boolean } {
    const time = Math.max(0, dt)
    this.protectionLeft = Math.max(0, this.protectionLeft - time)
    const rebuilt = this.rebuilt
    this.rebuilt = false
    const retreat =
      (Math.min(time, this.retreatLeft) * BUY_WALL.retreatDistance) / BUY_WALL.retreatSeconds
    this.retreatLeft = Math.max(0, this.retreatLeft - time)
    if (!this.active) {
      this.rebuildLeft = Math.max(0, this.rebuildLeft - time)
      if (this.rebuildLeft === 0) this.hp = this.maxHp
      return { retreat, fire: false, rebuilt: this.active }
    }
    this.shotClock += time
    const fire =
      this.shotClock >= BUY_WALL.shotSeconds &&
      (this.shots + 1) * BUY_WALL.sellsPerShot <= this.sells
    if (fire) {
      this.shots++
      this.shotClock = 0
    }
    return { retreat, fire, rebuilt }
  }
}

/** 매도벽 한 개의 기존 가격 눈금은 2%. 실패하면 전투 추가 수익은 없다. */
export function assaultBonusPercent(win: boolean, wallsBroken: number): number {
  return win ? Math.min(10, Math.max(0, Math.floor(wallsBroken))) * 2 : 0
}
