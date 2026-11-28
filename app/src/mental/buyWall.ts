import { orderHp } from './enemies'

/** 매수 주문이 위로 날아가는 빠르기(px/초). */
export const BUY_ORDER_SPEED = 360

export const BUY_WALL = {
  hpRatio: 0.5,
  mentalLossRatio: 0.08,
  rebuildSeconds: 1.5,
  protectionSeconds: 1,
  shotSeconds: 0.35,
  shotJitter: 0.2,
  shotsPerSell: 2,
  retreatSeconds: 0.7,
  retreatDistance: 80,
  /** 자동 전투의 재건 시간(초, 492번): 그동안 공격이 멈춘다. 무너져도 벽 번호는 그대로다 (584번). */
  idleRebuildSeconds: 2,
  /** 스테이지의 매수 주문 한 장의 바탕 피해 (514·688번): 공격력에 곱한다. 자동 전투는 그 벽의 매도 주문과 같은 수량이다 (710번, idleBuyOrderDamage). */
  orderDamage: 1.0,
} as const

/**
 * 자동 전투의 매수 주문 한 장의 피해 (710번): 그 벽의 매도 주문 한 장과 같은 수량이다. sellScale은 매도 물량의 수량 배율(물량 배율 × 매도 물량
 * 세기)이다. 매수벽 공격 강화와 팀 화력의 덤(514·573·638·689번)은 없앴다. 서버 IdleEngine.buyOrder와 같다.
 */
export function idleBuyOrderDamage(sellScale: number) {
  return orderHp('order', sellScale)
}

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

/** 매수벽이 깎인 양을 하나로 합치는 시간(ms): 매도벽 쪽 데미지 숫자(damageNumbers.ts의 MERGE_MS)와 같다. */
export const BUY_LOSS_MERGE_MS = 150

/**
 * 매수벽이 깎일 때 뜨는 "매수 -N주" (#915): 여러 물량이 한꺼번에 닿으면 글자가 겹쳐 뭉개졌다. 처음 뜬 때부터 BUY_LOSS_MERGE_MS 안에 깎인
 * 양은 떠 있는 글자에 더한다.
 */
export class BuyLossNote {
  total = 0
  private born = Number.NEGATIVE_INFINITY
  /** 깎인 양을 더한다. 떠 있는 글자에 합쳤으면 true, 새 글자를 띄워야 하면 false다. */
  add(lost: number, now: number): boolean {
    if (now - this.born < BUY_LOSS_MERGE_MS) {
      this.total += lost
      return true
    }
    this.born = now
    this.total = lost
    return false
  }
}

/** 글자의 가운데 x를 화면 안쪽으로 묶는다: 폭이 width인 글자가 양 끝에서 margin만큼 떨어진다. */
export function noteX(x: number, width: number, viewWidth: number, margin = 8): number {
  const half = width / 2 + margin
  return Math.max(half, Math.min(viewWidth - half, x))
}

/** 매도 물량 하나당 매수 주문 두 개로 맞선다. 붕괴하면 후퇴하고 1.5초 뒤 새 벽을 세운다. */
export class BuyWall {
  maxHp: number
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
  private readonly rebuildSeconds: number
  constructor(
    maxMental: number,
    random: () => number = Math.random,
    rebuildSeconds: number = BUY_WALL.rebuildSeconds,
  ) {
    this.random = random
    this.rebuildSeconds = rebuildSeconds
    this.nextShot = this.shotDelay()
    this.maxHp = Math.max(1, Math.round(maxMental * BUY_WALL.hpRatio))
    this.hp = this.maxHp
  }
  private shotDelay() {
    return BUY_WALL.shotSeconds + (this.random() * 2 - 1) * BUY_WALL.shotJitter
  }
  /** 방어선 구축 (503번): 벽이 바로 다시 서고 seconds 동안 깎이지 않는다. */
  fortify(seconds: number) {
    this.hp = this.maxHp
    this.rebuildLeft = 0
    this.retreatLeft = 0
    this.protectionLeft = Math.max(this.protectionLeft, seconds)
  }
  /**
   * 손절 (591번): 서 있는 벽의 지금 체력에서 ratio만큼을 버리고 버린 양을 돌려준다. 벽은 무너지지 않고(1은 남는다) 무적 중에도 버린다.
   * 무너져 있으면 버릴 것이 없다.
   */
  sacrifice(ratio: number): number {
    if (!this.active) return 0
    const lost = Math.min(this.hp - 1, Math.floor(this.hp * Math.min(1, Math.max(0, ratio))))
    this.hp -= lost
    return lost
  }
  /** 서킷브레이커 (#913): 서 있는 벽의 깎인 체력을 amount만큼 되채운다. 무너진 벽은 재건을 기다린다. */
  recover(amount: number) {
    if (this.active) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount))
  }
  get active() {
    return this.hp > 0
  }
  /** 체력 강화를 사면 서 있는 벽도 그만큼 두꺼워진다 (492번). */
  resize(maxMental: number) {
    const next = Math.max(1, Math.round(maxMental * BUY_WALL.hpRatio))
    if (this.active) this.hp = Math.max(1, this.hp + next - this.maxHp)
    this.maxHp = next
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
    this.rebuildLeft = this.rebuildSeconds
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
