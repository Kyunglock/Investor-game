import { shareLabel } from './shares'

/**
 * 데미지 숫자 (decisions.md 391번): 적이 피해를 받는 모든 경우에 숫자를 띄운다. 334번의 "한 방에 안 죽는 적에만"을 뒤집었다. 숫자가 화면을 덮지
 * 않게 짧은 시간 같은 적의 같은 피해는 하나로 합치고, 새로 뜨는 숫자는 살짝 흩뿌리며, 텍스트는 풀로 돌려 쓴다. 이 모듈은 Phaser 없이 규칙만 가진다
 * (그리는 것은 battle.ts의 damageNumber).
 */

/** 피해 종류: 총알·치명타(리볼버)·마법 넷(물·메테오·번개·땅)·번개 튐. 땅(433번)은 충차가 지나가며 밀친 피해, 들이받기(siege)는 벽·큰손을 들이받는 한 방이라 크고 합치지 않는다. */
export type DamageKind =
  | 'bullet'
  | 'crit'
  | 'water'
  | 'meteor'
  | 'lightning'
  | 'earth'
  | 'siege'
  | 'chain'

export interface DamageStyle {
  /** 글자 색(윤곽은 잉크색). 치명타는 따로 둔 풀의 금빛 글자에 빨간 윤곽이다. */
  color: string
  /** 기준 글자(24px)에 대한 크기. */
  scale: number
  /** 떠 있는 시간(ms)과 떠오르는 높이(px). */
  life: number
  rise: number
  /** 같은 적의 같은 피해를 MERGE_MS 안에서 하나로 합치나. 치명타는 한 방 한 방이 사건이라 합치지 않는다. */
  merge: boolean
}

/** 숫자 글자의 기준 크기(px). 종류별 크기는 글자를 다시 그리지 않고 배율로만 바꾼다(글자 크기를 바꾸면 글자 폭을 다시 잰다). */
export const DAMAGE_FONT_PX = 24

export const DAMAGE_STYLE: Record<DamageKind, DamageStyle> = {
  bullet: { color: '#ffffff', scale: 0.7, life: 460, rise: 26, merge: true },
  crit: { color: '#ffd84d', scale: 1.05, life: 640, rise: 34, merge: false },
  water: { color: '#6cc8ff', scale: 0.7, life: 460, rise: 26, merge: true },
  meteor: { color: '#ff926f', scale: 0.7, life: 460, rise: 26, merge: true },
  lightning: { color: '#ffe94d', scale: 0.7, life: 460, rise: 26, merge: true },
  earth: { color: '#e0a860', scale: 0.7, life: 460, rise: 26, merge: true },
  siege: { color: '#ffb35c', scale: 0.95, life: 600, rise: 32, merge: false },
  chain: { color: '#ffe94d', scale: 0.6, life: 420, rise: 22, merge: true },
}

/** 같은 적의 같은 피해를 하나로 합치는 시간(ms): 처음 뜬 때부터 센다(합쳐도 오래 남지 않게). */
export const MERGE_MS = 150

/** 화면에 동시에 떠 있는 숫자의 최대: 넘치면 가장 오래된 숫자를 돌려 쓴다. 치명타는 따로. */
export const DAMAGE_POOL = 36
export const CRIT_POOL = 8

/** 보이는 숫자: 전투 피해(1이 패닉 체력)를 10배로 보인다. 아무리 작아도 1. */
export function shownDamage(amount: number): number {
  return Math.max(1, Math.round(amount * 10))
}

/** 숫자 글자: 치명타만 느낌표가 붙는다. */
export function damageLabel(kind: DamageKind, amount: number, shares = false): string {
  const n = shares ? shareLabel(amount) : shownDamage(amount)
  return kind === 'crit' ? `${n}!` : String(n)
}

const SCATTER: readonly (readonly [number, number])[] = [
  [0, 0],
  [-13, -5],
  [13, -3],
  [-6, -11],
  [7, -9],
  [-15, 2],
  [15, 4],
]

/** 같은 적에 n번째(0부터)로 새로 뜨는 숫자의 흩뿌림(px): 앞의 숫자와 겹치지 않게 양옆·위로 돈다. */
export function scatterOffset(n: number): { dx: number; dy: number } {
  const [dx, dy] = SCATTER[((n % SCATTER.length) + SCATTER.length) % SCATTER.length]
  return { dx, dy }
}

export interface DamageSlot<T> {
  item: T
  /** 이 칸이 지금 보이는 숫자의 적과 종류, 합친 피해, 처음 뜬 때(ms). 비어 있으면 owner가 null. */
  owner: object | null
  kind: DamageKind | null
  total: number
  born: number
}

/**
 * 숫자 텍스트 풀. 같은 적·같은 종류가 MERGE_MS 안이면 그 칸에 피해를 더하고(merged), 아니면 가장 오래된 칸을 돌려 쓴다. n은 그 적에 새로 뜬
 * 숫자의 차례(흩뿌림에 쓴다).
 */
export class DamagePool<T> {
  readonly slots: DamageSlot<T>[]
  private next = 0
  private readonly counts = new WeakMap<object, number>()

  constructor(items: T[]) {
    this.slots = items.map((item) => ({ item, owner: null, kind: null, total: 0, born: 0 }))
  }

  take(owner: object, kind: DamageKind, amount: number, now: number) {
    if (DAMAGE_STYLE[kind].merge) {
      for (const slot of this.slots) {
        if (slot.owner === owner && slot.kind === kind && now - slot.born < MERGE_MS) {
          slot.total += amount
          return { slot, merged: true, n: this.counts.get(owner) ?? 0 }
        }
      }
    }
    const slot = this.slots[this.next]
    this.next = (this.next + 1) % this.slots.length
    const n = (this.counts.get(owner) ?? -1) + 1
    this.counts.set(owner, n)
    slot.owner = owner
    slot.kind = kind
    slot.total = amount
    slot.born = now
    return { slot, merged: false, n }
  }

  /** 숫자가 다 사라졌다: 이 칸에는 더 합치지 않는다. */
  release(slot: DamageSlot<T>) {
    slot.owner = null
    slot.kind = null
  }

  /** 지금 숫자를 띄우고 있는 칸 수. */
  live(): number {
    return this.slots.filter((s) => s.owner !== null).length
  }
}
