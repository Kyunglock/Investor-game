import type { Company } from '@web/api/client'

/**
 * 꾹 눌러 연속으로 올리는 전투 강화 (decisions.md 394번). 화면은 누를 때마다 단계를 줄에 세워 두고, 서버에는 한 번에 한 요청만 보낸다: 요청이
 * 가는 동안 쌓인 단계는 다음 요청에 "n단계 올리기"로 묶인다. 값과 자본은 서버가 정하고, 화면은 그사이 단계·값·남은 자본을 미리 셈해 보인다.
 */
export type UpgradeKind = NonNullable<Company['battleUpgrades']>[number]['kind']
type Upgrade = NonNullable<Company['battleUpgrades']>[number]

/** 강화 종류, 줄을 비우는 차례이기도 하다 (410번 체력). */
const KINDS = ['damage', 'fire', 'hp', 'buy', 'crit'] as const

/** 한 요청에 묶는 최대 단계 수 (서버 mental.upgrades.max-batch와 같다). */
export const MAX_BATCH = 100

/** 꾹 누른 지 step번째 오름 뒤 다음 오름까지 기다리는 시간(ms): 0.4초에서 시작해 매번 0.8배씩 줄어 0.05초까지 (394번). */
export function holdDelay(step: number): number {
  return Math.max(50, Math.round(400 * 0.8 ** step))
}

/** 차오르는 빛 (0~1): 가장 빨라지는(0.05초) 때쯤 꽉 찬다. */
export function holdCharge(step: number): number {
  return Math.min(1, step / 10)
}

/** 다음 값 price에서 시작해 from단계 뒤부터 count단계를 더 사는 값(미리 셈, 서버와 반올림이 조금 다를 수 있다). */
export function queuedCost(price: number, growthPercent: number, from: number, count: number) {
  const g = 1 + growthPercent / 100
  let sum = 0
  for (let i = from; i < from + count; i++) {
    sum += Math.round(price * g ** i)
  }
  return sum
}

interface InFlight {
  kind: UpgradeKind
  levels: number
  /** 보낼 때의 단계·다음 값·자본 */
  level: number
  price: number
  capital: number
  cost: number
}

export interface UpgradeView {
  kind: UpgradeKind
  level: number
  /** 다음 단계 값 */
  price: number
  bonusPercent: number
  nextBonusPercent: number
}

export class UpgradeQueue {
  private pending: Record<UpgradeKind, number> = { damage: 0, fire: 0, hp: 0, buy: 0, crit: 0 }
  private flight: InFlight | null = null

  private readonly send: (kind: UpgradeKind, levels: number) => Promise<Company | null>
  private readonly company: () => Company | null
  private readonly onChange: () => void
  /** 서버가 덜 사 주었거나(자본) 요청이 실패했다: 꾹 누르기를 멈춘다. */
  private readonly onShort: (kind: UpgradeKind) => void

  constructor(
    send: (kind: UpgradeKind, levels: number) => Promise<Company | null>,
    company: () => Company | null,
    onChange: () => void,
    onShort: (kind: UpgradeKind) => void = () => {},
  ) {
    this.send = send
    this.company = company
    this.onChange = onChange
    this.onShort = onShort
  }

  private upgrade(kind: UpgradeKind): Upgrade | undefined {
    return this.company()?.battleUpgrades?.find((u) => u.kind === kind)
  }

  /** 줄에 선 단계(보내는 중 포함)를 뺀 지금 모습. 보내는 동안은 서버 값 대신 보낼 때 값으로 셈해 응답이 오는 순간에도 튀지 않는다. */
  private base(kind: UpgradeKind) {
    const u = this.upgrade(kind)
    if (!u) return null
    const f = this.flight
    if (f && f.kind === kind) {
      const g = 1 + u.priceGrowthPercent / 100
      return { u, level: f.level + f.levels, price: f.price * g ** f.levels }
    }
    return { u, level: u.level, price: u.price }
  }

  /** 줄에 선 단계까지 산 뒤 남을 자본. */
  capital(): number {
    const c = this.company()
    if (!c) return 0
    const f = this.flight
    let left = f ? f.capital - f.cost : c.capital
    for (const kind of KINDS) {
      const b = this.base(kind)
      if (b && this.pending[kind] > 0) {
        left -= queuedCost(b.price, b.u.priceGrowthPercent, 0, this.pending[kind])
      }
    }
    return left
  }

  view(kind: UpgradeKind): UpgradeView | null {
    const b = this.base(kind)
    if (!b) return null
    const step = b.u.nextBonusPercent - b.u.bonusPercent
    const level = b.level + this.pending[kind]
    const g = 1 + b.u.priceGrowthPercent / 100
    return {
      kind,
      level,
      price: Math.round(b.price * g ** this.pending[kind]),
      bonusPercent: level * step,
      nextBonusPercent: (level + 1) * step,
    }
  }

  /** 다음 단계를 살 자본이 있는가. */
  affordable(kind: UpgradeKind): boolean {
    const v = this.view(kind)
    return v != null && this.capital() >= v.price
  }

  /** 한 단계를 줄에 세운다. 자본이 모자라면 거짓. */
  push(kind: UpgradeKind): boolean {
    if (!this.affordable(kind)) return false
    this.pending[kind]++
    this.onChange()
    void this.pump()
    return true
  }

  busy(): boolean {
    return this.flight != null || KINDS.some((k) => this.pending[k] > 0)
  }

  private async pump() {
    if (this.flight) return
    const kind = KINDS.find((k) => this.pending[k] > 0)
    const c = this.company()
    const u = kind && this.upgrade(kind)
    if (!kind || !c || !u) return
    const levels = Math.min(this.pending[kind], MAX_BATCH)
    this.pending[kind] -= levels
    this.flight = {
      kind,
      levels,
      level: u.level,
      price: u.price,
      capital: c.capital,
      cost: queuedCost(u.price, u.priceGrowthPercent, 0, levels),
    }
    const after = await this.send(kind, levels)
    this.flight = null
    const bought = after?.battleUpgrades?.find((x) => x.kind === kind)?.level
    if (bought == null || bought - u.level < levels) {
      // 자본이 모자라 덜 샀거나 실패했다: 줄을 비우고 서버가 정한 값으로 돌아간다.
      this.pending = { damage: 0, fire: 0, hp: 0, buy: 0, crit: 0 }
      this.onChange()
      this.onShort(kind)
      return
    }
    this.onChange()
    void this.pump()
  }
}
