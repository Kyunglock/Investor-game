import type { Spell } from './cards'
import {
  type FallSpell,
  type FlowSpell,
  isArrowSpell,
  isFallSpell,
  isFlowSpell,
  ramp,
  SPELLBOOK,
} from './spellbook'

/**
 * 물·메테오·번개·땅 마법 (decisions.md 392번, 377번의 "총알에 덤으로 붙는 마법"을 뒤집음. 땅은 433번). 마법은 총알과 따로, 제 주기마다 스스로 나간다. 처음 고르면 Lv.1이고
 * 같은 마법을 또 고를 때마다 한 레벨씩 오른다(최대 MAGIC_MAX_LEVEL). 레벨이 오를수록 쿨다운·피해·범위가 좋아지고, 연출은 세 단계(MagicTier)로 눈에 띄게
 * 화려해진다. 피해는 총알 피해가 아니라 마법 자체의 배율 × 지금 공격력(무기·자본 강화·공격력 카드)이다. 이 모듈은 Phaser 없이 규칙만 가진다(그리는 것은
 * battle.ts의 마법 부분).
 *
 * 696번: 범위 공격은 2배, 단일 공격(번개 첫 타격·충차·얼음과 spellbook의 화살·빛·독)은 10배로 올렸다. 번개가 튀는 피해는 범위라
 * 2배에 머물도록 chainDamage를 5분의 1로 낮췄다. 피해 배율은 서버 IdleEngine.SKILL_DAMAGE와 같아야 한다.
 */

export const MAGIC_MAX_LEVEL = 5

/** 연출 단계: 물방울→물줄기→큰 물결, 운석→대운석→유성우, 가는 번개→굵은 번개→여러 갈래, 돌 충차→바위 충차→대지 충차. 4·5레벨은 3단계 연출이 조금 더 커진다. */
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
  /** 얼음 (561번): 맞은 적이 얼어붙어 멈추는 시간(초). 물은 0. */
  stunSeconds: number
  /** 바람 (561번): 맞은 적이 뒤로 밀려나는 시간(초). 물은 0. */
  pushSeconds: number
}

export interface MeteorStats {
  cooldown: number
  damage: number
  /** 떨어진 자리에서 터지는 반지름(px). */
  radius: number
  /** 시간차로 떨어지는 운석 수, 경고 시간과 기절 시간(초). */
  count: number
  warning: number
  stunSeconds: number
}

export interface LightningStats {
  cooldown: number
  damage: number
  /** 맞은 적에서 옆 적으로 튀는 수(2^레벨), 튄 피해 비율, 튀는 거리(px). */
  chains: number
  chainDamage: number
  chainRadius: number
  /** 한 번에 내리꽂는 번개 줄기 수. */
  bolts: number
}

/** 매도벽 돌파용 충차. 매도벽에만 damage × siege 피해를 주며, 일반 적과 보스는 통과한다. */
export interface EarthStats {
  cooldown: number
  /** 매도벽 피해의 기본 공격력 배율. siege를 곱해 적용한다. */
  damage: number
  siege: number
  /** 맞는 폭의 절반(px)과 다 달린 빠르기(px/s). 처음엔 느리게 출발해 빨라진다. */
  half: number
  speed: number
  /** 지나가며 옆으로 밀쳐 내는 세기(px/s). */
  push: number
  /** 들이받은 자리의 시각 효과 반지름(px, 3단계부터). 주변 피해는 없다. */
  quake: number
}

const EARTH: readonly EarthStats[] = [
  // 456번: 벽에 너무 셌다(벽 초당 피해가 번개의 1.4~2배). 배율을 낮추고 높은 레벨의 주기를 늘려 번개의 1.2배 남짓으로 맞춘다.
  { cooldown: 3.6, damage: 12, siege: 3.4, half: 16, speed: 560, push: 260, quake: 0 },
  { cooldown: 3.2, damage: 16, siege: 3.6, half: 22, speed: 600, push: 320, quake: 0 },
  { cooldown: 3.0, damage: 21, siege: 3.8, half: 30, speed: 640, push: 380, quake: 70 },
  { cooldown: 2.8, damage: 25, siege: 4, half: 34, speed: 680, push: 420, quake: 85 },
  { cooldown: 2.6, damage: 29, siege: 4.2, half: 38, speed: 720, push: 460, quake: 100 },
]

const WATER: readonly WaterStats[] = [
  {
    cooldown: 2.4,
    damage: 3,
    half: 10,
    speed: 560,
    pierce: false,
    splash: 34,
    slowFactor: 0.6,
    slowSeconds: 1.5,
    stunSeconds: 0,
    pushSeconds: 0,
  },
  {
    cooldown: 2.1,
    damage: 4,
    half: 16,
    speed: 820,
    pierce: true,
    splash: 0,
    slowFactor: 0.5,
    slowSeconds: 2,
    stunSeconds: 0,
    pushSeconds: 0,
  },
  {
    cooldown: 1.8,
    damage: 5.2,
    half: 75,
    speed: 400,
    pierce: true,
    splash: 0,
    slowFactor: 0.4,
    slowSeconds: 2.5,
    stunSeconds: 0,
    pushSeconds: 0,
  },
  {
    cooldown: 1.6,
    damage: 6,
    half: 85,
    speed: 420,
    pierce: true,
    splash: 0,
    slowFactor: 0.35,
    slowSeconds: 2.8,
    stunSeconds: 0,
    pushSeconds: 0,
  },
  {
    cooldown: 1.4,
    damage: 6.8,
    half: 95,
    speed: 440,
    pierce: true,
    splash: 0,
    slowFactor: 0.3,
    slowSeconds: 3,
    stunSeconds: 0,
    pushSeconds: 0,
  },
]

/**
 * 얼음 (561번): 얼음 창이 곧게 날아가 지나가는 적을 모두 꿰뚫고 잠깐 얼린다. 느리게 차지만 한 방이 크다.
 * 주기와 피해는 서버(IdleEngine COOLDOWNS·SKILL_DAMAGE)와 같아야 한다.
 */
const ICE: readonly WaterStats[] = [
  [3.2, 32, 12, 0.4],
  [2.9, 44, 14, 0.5],
  [2.6, 56, 17, 0.6],
  [2.4, 66, 20, 0.7],
  [2.2, 76, 23, 0.8],
].map(([cooldown, damage, half, stunSeconds]) => ({
  cooldown,
  damage,
  half,
  speed: 900,
  pierce: true,
  splash: 0,
  slowFactor: 0.6,
  slowSeconds: 1.5,
  stunSeconds,
  pushSeconds: 0,
}))

/** 바람 (561번): 넓은 돌풍이 쓸고 가며 지나가는 적을 뒤로 밀어낸다. 자주 불지만 한 방은 가볍다. */
const WIND: readonly WaterStats[] = [
  [2.8, 3.6, 55, 0.12],
  [2.5, 4.8, 65, 0.15],
  [2.2, 6.2, 78, 0.18],
  [2, 7.2, 88, 0.21],
  [1.8, 8.2, 98, 0.24],
].map(([cooldown, damage, half, pushSeconds]) => ({
  cooldown,
  damage,
  half,
  speed: 520,
  pierce: true,
  splash: 0,
  slowFactor: 1,
  slowSeconds: 0,
  stunSeconds: 0,
  pushSeconds,
}))

const METEOR: readonly MeteorStats[] = [
  { cooldown: 3.6, damage: 9.6, radius: 50, count: 1, warning: 0.5, stunSeconds: 0.3 },
  { cooldown: 3.3, damage: 16.5, radius: 70, count: 1, warning: 0.5, stunSeconds: 0.35 },
  { cooldown: 3, damage: 8.4, radius: 82, count: 3, warning: 0.5, stunSeconds: 0.4 },
  { cooldown: 2.8, damage: 10.1, radius: 92, count: 3, warning: 0.5, stunSeconds: 0.45 },
  { cooldown: 2.6, damage: 8.84, radius: 105, count: 4, warning: 0.5, stunSeconds: 0.5 },
]

/** 중심은 100%, 가장자리는 65%. 원 밖은 피해가 없다. */
export function meteorFalloff(distance: number, radius: number): number {
  return distance > radius ? 0 : 1 - (0.35 * Math.max(0, distance)) / radius
}

const LIGHTNING: readonly LightningStats[] = [
  { cooldown: 2.6, damage: 25, chains: 2, chainDamage: 0.12, chainRadius: 150, bolts: 1 },
  { cooldown: 2.3, damage: 35, chains: 4, chainDamage: 0.12, chainRadius: 170, bolts: 1 },
  { cooldown: 2, damage: 45, chains: 8, chainDamage: 0.12, chainRadius: 190, bolts: 1 },
  { cooldown: 1.8, damage: 52, chains: 16, chainDamage: 0.13, chainRadius: 200, bolts: 2 },
  { cooldown: 1.6, damage: 60, chains: 32, chainDamage: 0.14, chainRadius: 210, bolts: 2 },
]

const at = <T>(table: readonly T[], level: number) =>
  table[Math.max(1, Math.min(MAGIC_MAX_LEVEL, level)) - 1]

export const waterStats = (level: number) => at(WATER, level)
export const meteorStats = (level: number) => at(METEOR, level)
export const lightningStats = (level: number) => at(LIGHTNING, level)
export const earthStats = (level: number) => at(EARTH, level)
export const iceStats = (level: number) => at(ICE, level)
export const windStats = (level: number) => at(WIND, level)
/** 물처럼 날아가는 마법: 물·얼음·바람과 spellbook의 flow 마법들 (563번). */
export type Flow = 'water' | 'ice' | 'wind' | FlowSpell
/** 메테오처럼 떨어지는 마법: 메테오와 spellbook의 fall 마법들 (563번). */
export type Fall = 'meteor' | FallSpell

/** 물처럼 날아가는 마법의 수치. spellbook의 마법은 표의 Lv.1·Lv.5 값 사이를 고르게 나눈다. */
export function flowStats(spell: Flow, level: number): WaterStats {
  if (spell === 'ice') return iceStats(level)
  if (spell === 'wind') return windStats(level)
  if (spell === 'water') return waterStats(level)
  const b = SPELLBOOK[spell]
  return {
    cooldown: ramp(b.cooldown, level),
    damage: ramp(b.damage, level),
    half: ramp(b.half, level),
    speed: b.speed,
    pierce: b.form !== 'drop',
    splash: ramp(b.splash, level),
    slowFactor: b.slowFactor,
    slowSeconds: b.slowSeconds,
    stunSeconds: ramp(b.stun, level),
    pushSeconds: ramp(b.push, level),
  }
}

/** 떨어지는 마법의 수치: 메테오의 수치에 느려짐이 더 있다. */
export interface FallStats extends MeteorStats {
  slowFactor: number
  slowSeconds: number
}

export function fallStats(spell: Fall, level: number): FallStats {
  if (spell === 'meteor') return { ...meteorStats(level), slowFactor: 1, slowSeconds: 0 }
  const b = SPELLBOOK[spell]
  return {
    cooldown: ramp(b.cooldown, level),
    damage: ramp(b.damage, level),
    radius: ramp(b.radius, level),
    count: b.count[Math.max(1, Math.min(MAGIC_MAX_LEVEL, level)) - 1],
    warning: 0.5,
    stunSeconds: ramp(b.stun, level),
    slowFactor: b.slowFactor,
    slowSeconds: b.slowSeconds,
  }
}

export const isFlow = (spell: Spell): spell is Flow =>
  spell === 'water' || spell === 'ice' || spell === 'wind' || isFlowSpell(spell)
export const isFall = (spell: Spell): spell is Fall => spell === 'meteor' || isFallSpell(spell)

export function auroraNightStats(level: number) {
  const spell = SPELLBOOK.auroraNight
  return { cooldown: ramp(spell.cooldown, level), damage: ramp(spell.damage, level) }
}

export function magicCooldown(magic: Spell, level: number): number {
  if (magic === 'auroraNight') return auroraNightStats(level).cooldown
  if (isFlow(magic)) return flowStats(magic, level).cooldown
  if (isFall(magic)) return fallStats(magic, level).cooldown
  if (magic === 'earth') return earthStats(level).cooldown
  return lightningStats(level).cooldown
}

/** 쏠 적이 없어 못 나갔을 때 다시 볼 때까지(초). */
export const MAGIC_RETRY_SECONDS = 0.25

/**
 * 한 시전자의 마법 시계. 마법은 쏘는 주체에서 떨어져 있다: 사장냥이 하나를 갖고, 함께 싸우는 고양이가 생기면 저마다 하나씩 가져 같은 레벨의 마법을
 * 제 자리에서 쏜다. 처음 배우거나 레벨이 오르면 곧바로 한 번 나간다.
 */
export class MagicClock {
  private readonly next: Partial<Record<Spell, number>> = {}

  due(magic: Spell, level: number, elapsed: number): boolean {
    return level > 0 && elapsed >= (this.next[magic] ?? 0)
  }

  cast(magic: Spell, level: number, elapsed: number) {
    const interval = magicCooldown(magic, level)
    const due = this.next[magic] ?? elapsed
    // Carry frame rounding forward during continuous fire, but never bank missed shots.
    const keepBeat = isArrowSpell(magic) && due <= elapsed && elapsed - due < interval
    this.next[magic] = (keepBeat ? due : elapsed) + interval
  }

  retry(magic: Spell, elapsed: number) {
    this.next[magic] = elapsed + MAGIC_RETRY_SECONDS
  }

  /** 레벨이 올랐다: 새 연출을 바로(at초부터) 보여 준다. 고양이가 여럿이면 at을 조금씩 늦춰 한꺼번에 겹쳐 나가지 않게 한다(393번). */
  ready(magic: Spell, at = 0) {
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

/** 메테오의 과녁: 반지름 안에 다른 적이 가장 많이 모인 적. 같으면 먼저 온 것. */
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

/**
 * 충차의 과녁: 매도벽 가운데 시전자에게 가장 가까운 것. 매도벽이 없으면 발사하지 않는다.
 */
export function siegeTarget<T extends Point & { hp: number }>(
  list: readonly T[],
  from: Point,
  isSiege: (t: T) => boolean,
): T | null {
  let best: T | null = null
  let bd = Number.POSITIVE_INFINITY
  for (const p of list) {
    if (!isSiege(p)) continue
    const d = dist2(p, from)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

/** 충차의 빠르기: 출발해서 RAM_SPOOL초 동안 다 달린 빠르기의 35%에서 100%까지 빨라진다(땅을 박차고 가속하는 맛). */
export const RAM_SPOOL = 0.35
export function ramSpeed(top: number, t: number): number {
  const k = Math.min(1, Math.max(0, t) / RAM_SPOOL)
  return top * (0.35 + 0.65 * k * k)
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

/** 매도벽은 몬스터가 없을 때만 노린다. 첫 낙뢰와 연쇄가 같은 대상 목록을 사용한다. */
export function lightningPlan<T extends Point & { hp: number }>(
  list: readonly T[],
  from: Point,
  stats: Pick<LightningStats, 'bolts' | 'chains' | 'chainRadius'>,
  isWall: (target: T) => boolean,
): { target: T; chain: T[] }[] {
  const monsters = list.filter((target) => !isWall(target))
  const candidates = monsters.length > 0 ? monsters : list
  const struck: T[] = []
  for (let i = 0; i < stats.bolts; i++) {
    const target = strongest(candidates, from, struck)
    if (!target) break
    struck.push(target)
  }
  // 피해 처리 전에 모든 경로를 정해 풀 재사용·처치가 다음 경로를 바꾸지 않게 한다.
  return struck.map((target) => ({
    target,
    chain: chainTargets(target, candidates, stats.chains, stats.chainRadius),
  }))
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
