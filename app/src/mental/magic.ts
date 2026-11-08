import type { Magic } from './cards'

/**
 * 물·불·번개 마법 (decisions.md 392번, 377번의 "총알에 덤으로 붙는 마법"을 뒤집음). 마법은 총알과 따로, 제 주기마다 스스로 나간다. 처음 고르면 Lv.1이고
 * 같은 마법을 또 고를 때마다 한 레벨씩 오른다(최대 MAGIC_MAX_LEVEL). 레벨이 오를수록 쿨다운·피해·범위가 좋아지고, 연출은 세 단계(MagicTier)로 눈에 띄게
 * 화려해진다. 피해는 총알 피해가 아니라 마법 자체의 배율 × 지금 공격력(무기·자본 강화·공격력 카드)이다. 이 모듈은 Phaser 없이 규칙만 가진다(그리는 것은
 * battle.ts의 마법 부분).
 */

export const MAGIC_MAX_LEVEL = 5

/** 연출 단계: 물방울→물줄기→큰 물결, 불씨→불덩이→불기둥, 가는 번개→굵은 번개→여러 갈래. 4·5레벨은 3단계 연출이 조금 더 커진다. */
export type MagicTier = 1 | 2 | 3

export function magicTier(level: number): MagicTier {
  return Math.max(1, Math.min(3, level)) as MagicTier
}

export interface WaterStats {
  cooldown: number
  /** 공격력에 곱하는 피해 배율. */
  damage: number
  /** 맞는 폭의 절반(px): 물방울은 좁고 큰 물결은 넓다. */
  half: number
  speed: number
  /** 물방울은 처음 맞은 적에서 터져 둘레(splash px)를 적시고, 물줄기·물결은 지나가는 적을 모두 맞힌다. */
  pierce: boolean
  splash: number
  /** 맞은 적의 빠르기 배율과 그 시간(초). */
  slowFactor: number
  slowSeconds: number
}

export interface FireStats {
  cooldown: number
  damage: number
  /** 떨어진 자리에서 터지는 반지름(px). */
  radius: number
  /** 둘레의 적이 초마다 타는 피해(공격력 배율)와 시간(초). */
  burnDps: number
  burnSeconds: number
  /** 떨어진 자리에 불길이 남는 시간(초): 그동안 들어온 적도 탄다. */
  patchSeconds: number
}

export interface LightningStats {
  cooldown: number
  damage: number
  /** 맞은 적에서 옆 적으로 튀는 수, 튄 피해 비율, 튀는 거리(px). */
  chains: number
  chainDamage: number
  chainRadius: number
  /** 한 번에 내리꽂는 번개 줄기 수. */
  bolts: number
}

const WATER: readonly WaterStats[] = [
  {
    cooldown: 2.4,
    damage: 1.5,
    half: 10,
    speed: 560,
    pierce: false,
    splash: 34,
    slowFactor: 0.6,
    slowSeconds: 1.5,
  },
  {
    cooldown: 2.1,
    damage: 2,
    half: 16,
    speed: 820,
    pierce: true,
    splash: 0,
    slowFactor: 0.5,
    slowSeconds: 2,
  },
  {
    cooldown: 1.8,
    damage: 2.6,
    half: 75,
    speed: 400,
    pierce: true,
    splash: 0,
    slowFactor: 0.4,
    slowSeconds: 2.5,
  },
  {
    cooldown: 1.6,
    damage: 3,
    half: 85,
    speed: 420,
    pierce: true,
    splash: 0,
    slowFactor: 0.35,
    slowSeconds: 2.8,
  },
  {
    cooldown: 1.4,
    damage: 3.4,
    half: 95,
    speed: 440,
    pierce: true,
    splash: 0,
    slowFactor: 0.3,
    slowSeconds: 3,
  },
]

const FIRE: readonly FireStats[] = [
  { cooldown: 3, damage: 2, radius: 42, burnDps: 1, burnSeconds: 2, patchSeconds: 1 },
  { cooldown: 2.7, damage: 3, radius: 60, burnDps: 1.5, burnSeconds: 2.5, patchSeconds: 1.6 },
  { cooldown: 2.4, damage: 4, radius: 85, burnDps: 2, burnSeconds: 3, patchSeconds: 2.2 },
  { cooldown: 2.2, damage: 4.6, radius: 95, burnDps: 2.4, burnSeconds: 3, patchSeconds: 2.5 },
  { cooldown: 2, damage: 5.2, radius: 105, burnDps: 2.8, burnSeconds: 3, patchSeconds: 2.8 },
]

const LIGHTNING: readonly LightningStats[] = [
  { cooldown: 2.6, damage: 2.5, chains: 1, chainDamage: 0.6, chainRadius: 150, bolts: 1 },
  { cooldown: 2.3, damage: 3.5, chains: 2, chainDamage: 0.6, chainRadius: 170, bolts: 1 },
  { cooldown: 2, damage: 4.5, chains: 4, chainDamage: 0.6, chainRadius: 190, bolts: 1 },
  { cooldown: 1.8, damage: 5.2, chains: 5, chainDamage: 0.65, chainRadius: 200, bolts: 2 },
  { cooldown: 1.6, damage: 6, chains: 6, chainDamage: 0.7, chainRadius: 210, bolts: 2 },
]

const at = <T>(table: readonly T[], level: number) =>
  table[Math.max(1, Math.min(MAGIC_MAX_LEVEL, level)) - 1]

export const waterStats = (level: number) => at(WATER, level)
export const fireStats = (level: number) => at(FIRE, level)
export const lightningStats = (level: number) => at(LIGHTNING, level)

export function magicCooldown(magic: Magic, level: number): number {
  if (magic === 'water') return waterStats(level).cooldown
  if (magic === 'fire') return fireStats(level).cooldown
  return lightningStats(level).cooldown
}

/** 쏠 적이 없어 못 나갔을 때 다시 볼 때까지(초). */
export const MAGIC_RETRY_SECONDS = 0.25

/**
 * 한 시전자의 마법 시계. 마법은 쏘는 주체에서 떨어져 있다: 사장냥이 하나를 갖고, 함께 싸우는 고양이가 생기면 저마다 하나씩 가져 같은 레벨의 마법을
 * 제 자리에서 쏜다. 처음 배우거나 레벨이 오르면 곧바로 한 번 나간다.
 */
export class MagicClock {
  private readonly next: Record<Magic, number> = { water: 0, fire: 0, lightning: 0 }

  due(magic: Magic, level: number, elapsed: number): boolean {
    return level > 0 && elapsed >= this.next[magic]
  }

  cast(magic: Magic, level: number, elapsed: number) {
    this.next[magic] = elapsed + magicCooldown(magic, level)
  }

  retry(magic: Magic, elapsed: number) {
    this.next[magic] = elapsed + MAGIC_RETRY_SECONDS
  }

  /** 레벨이 올랐다: 새 연출을 바로(at초부터) 보여 준다. 고양이가 여럿이면 at을 조금씩 늦춰 한꺼번에 겹쳐 나가지 않게 한다(393번). */
  ready(magic: Magic, at = 0) {
    this.next[magic] = at
  }
}

interface Point {
  x: number
  y: number
}

const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

/** 물의 과녁: 시전자에게 가장 가까운 적. */
export function nearestTo<T extends Point>(list: readonly T[], from: Point): T | null {
  let best: T | null = null
  let bd = Number.POSITIVE_INFINITY
  for (const p of list) {
    const d = dist2(p, from)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

/** 불의 과녁: 반지름 안에 다른 적이 가장 많이 모인 적. 같으면 먼저 온 것. */
export function densest<T extends Point>(list: readonly T[], radius: number): T | null {
  let best: T | null = null
  let most = -1
  const r2 = radius * radius
  for (const p of list) {
    let n = 0
    for (const o of list) {
      if (o !== p && dist2(p, o) <= r2) n++
    }
    if (n > most) {
      most = n
      best = p
    }
  }
  return best
}

/** 번개의 과녁: 체력이 가장 많이 남은 적(보스·투기를 먼저). 같으면 시전자에게 가까운 쪽. skip에 든 적은 뺀다. */
export function strongest<T extends Point & { hp: number }>(
  list: readonly T[],
  from: Point,
  skip: readonly T[] = [],
): T | null {
  let best: T | null = null
  for (const p of list) {
    if (skip.includes(p)) continue
    if (!best || p.hp > best.hp || (p.hp === best.hp && dist2(p, from) < dist2(best, from))) {
      best = p
    }
  }
  return best
}

/** 번개가 튀는 차례: 맞은 적에서 가장 가까운 안 맞은 적으로, 거기서 다시 가장 가까운 적으로. 한 번 맞은 적에게는 다시 튀지 않는다. */
export function chainTargets<T extends Point>(
  first: T,
  list: readonly T[],
  count: number,
  radius: number,
): T[] {
  const out: T[] = []
  const r2 = radius * radius
  let from = first
  while (out.length < count) {
    let best: T | null = null
    let bd = r2
    for (const p of list) {
      if (p === first || out.includes(p)) continue
      const d = dist2(p, from)
      if (d <= bd) {
        bd = d
        best = p
      }
    }
    if (!best) break
    out.push(best)
    from = best
  }
  return out
}

/**
 * 날아가는 물(물방울·물줄기·물결)이 적에 닿았나: 나아가는 방향(dx, dy 단위 벡터)으로 앞뒤 depth, 옆으로 half 안에 적의 원(반지름 r)이 걸치면 닿는다.
 */
export function sweepHits(
  shot: Point & { dx: number; dy: number; half: number; depth: number },
  p: Point,
  r: number,
): boolean {
  const rx = p.x - shot.x
  const ry = p.y - shot.y
  const along = rx * shot.dx + ry * shot.dy
  const across = Math.abs(rx * shot.dy - ry * shot.dx)
  return Math.abs(along) <= shot.depth + r && across <= shot.half + r
}
