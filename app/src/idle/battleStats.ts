import { sharesOf } from '../mental/shares'

/**
 * 전투 통계 (decisions.md 645번): 화면이 서버에 보낸 명중을 쏜 곳마다 모아 10분 창으로 보인다. 창은 시계에 맞춘 10분(14:00~14:10)이고
 * 경계를 넘으면 처음부터 센다. 전투의 피해(1이 벽 체력 1)를 그대로 더하고, 보일 때 벽처럼 주로 바꾼다.
 */
export const STATS_WINDOW_MS = 10 * 60_000

/** 명중과 명중 사이가 이보다 길면 쉬고 있던 것으로 본다: 초당 피해를 잴 때 그 틈은 빼고 이만큼만 센다. */
export const IDLE_GAP_MS = 5_000

/** 매수 주문으로 세는 명중 종류: 매수 주문, 매수세례, 손절. */
const BUY_KINDS = new Set(['buy', 'barrage', 'stoploss'])

export interface StatsHit {
  kind: string
  damage: number
  /** 총알을 쏜 고양이: 'boss'는 사장냥, 그 밖은 고양이 코드. 스킬·매수 주문과 모르는 총알은 null. */
  owner: string | null
  crit: boolean
}

export interface BattleStats {
  /** 이 창이 시작한 때(ms, 10분의 배수). */
  start: number
  /** 쏜 곳마다의 피해: 'gun:boss'·'gun:<고양이>'·'skill:<스킬>'·'buy'·'gun:?'. */
  damage: Record<string, number>
  /** 총알 명중 수와 그 가운데 치명타 수. 관통으로 뒤 벽을 맞힌 것도 한 번씩 센다. */
  shots: number
  crits: number
  /** 가장 큰 한 방(전투의 피해). */
  best: number
  /** 이 창에서 서버가 넘어간 매도벽 수. */
  walls: number
  /** 싸운 시간(ms): 명중 사이의 틈을 IDLE_GAP_MS까지만 더한다. */
  activeMs: number
  /** 마지막 명중의 때(ms). 없으면 0. */
  lastHit: number
}

export function windowStart(now: number): number {
  return Math.floor(now / STATS_WINDOW_MS) * STATS_WINDOW_MS
}

export function emptyStats(now: number): BattleStats {
  return {
    start: windowStart(now),
    damage: {},
    shots: 0,
    crits: 0,
    best: 0,
    walls: 0,
    activeMs: 0,
    lastHit: 0,
  }
}

/** 지금의 창: 창이 바뀌었으면 새로 비운다. */
export function current(stats: BattleStats | null, now: number): BattleStats {
  return stats && stats.start === windowStart(now) ? stats : emptyStats(now)
}

function sourceOf(hit: StatsHit): string {
  if (BUY_KINDS.has(hit.kind)) return 'buy'
  if (hit.kind !== 'bullet') return `skill:${hit.kind}`
  return `gun:${hit.owner ?? '?'}`
}

/** 명중 하나를 더한다. 창이 바뀌었으면 새 창에 더한 것을 돌려준다. */
export function record(stats: BattleStats | null, now: number, hit: StatsHit): BattleStats {
  const next = current(stats, now)
  if (!Number.isFinite(hit.damage) || hit.damage <= 0) return next
  const source = sourceOf(hit)
  next.damage[source] = (next.damage[source] ?? 0) + hit.damage
  if (hit.kind === 'bullet') {
    next.shots++
    if (hit.crit) next.crits++
  }
  next.best = Math.max(next.best, hit.damage)
  if (next.lastHit > 0) next.activeMs += Math.min(IDLE_GAP_MS, Math.max(0, now - next.lastHit))
  next.lastHit = now
  return next
}

/** 서버가 넘어간 벽을 더한다. */
export function addWalls(stats: BattleStats | null, now: number, walls: number): BattleStats {
  const next = current(stats, now)
  if (walls > 0) next.walls += walls
  return next
}

export interface StatsCat {
  code: string
  name: string
  skills: readonly { code: string; name: string }[]
}

export interface StatsRow {
  code: string
  name: string
  /** 총 피해와 그 가운데 스킬 피해. */
  damage: number
  skill: number
  /** 이 창의 모든 피해에서 차지하는 몫(0~1). */
  share: number
}

export interface StatsSummary {
  total: number
  /** 출전 고양이(사장냥 포함)의 피해 순위: 많이 넣은 차례. */
  rows: StatsRow[]
  /** 매수 주문과 스킬이 모든 피해에서 차지하는 몫(0~1). */
  buyShare: number
  skillShare: number
  /** 싸운 시간 1초에 넣은 피해. 아직 싸운 시간이 없으면 0. */
  perSecond: number
  shots: number
  crits: number
  best: number
  walls: number
  /** 다음 창까지 남은 ms. */
  left: number
}

/** 화면에 보일 것: 사장냥과 출전한 고양이마다 총과 그 고양이 스킬의 피해를 더해 줄 세운다. */
export function summarize(
  stats: BattleStats | null,
  now: number,
  cats: readonly StatsCat[],
): StatsSummary {
  const s = current(stats, now)
  const total = Object.values(s.damage).reduce((sum, n) => sum + n, 0)
  const of = (key: string) => s.damage[key] ?? 0
  const skillTotal = Object.entries(s.damage)
    .filter(([key]) => key.startsWith('skill:'))
    .reduce((sum, [, n]) => sum + n, 0)
  const team: StatsCat[] = [{ code: 'boss', name: '사장냥', skills: [] }, ...cats]
  const rows = team
    .map((cat) => {
      const skill = cat.skills.reduce((sum, k) => sum + of(`skill:${k.code}`), 0)
      const damage = of(`gun:${cat.code}`) + skill
      return {
        code: cat.code,
        name: cat.name,
        damage,
        skill,
        share: total > 0 ? damage / total : 0,
      }
    })
    .sort((a, b) => b.damage - a.damage)
  return {
    total,
    rows,
    buyShare: total > 0 ? of('buy') / total : 0,
    skillShare: total > 0 ? skillTotal / total : 0,
    perSecond: s.activeMs > 0 ? total / (s.activeMs / 1000) : 0,
    shots: s.shots,
    crits: s.crits,
    best: s.best,
    walls: s.walls,
    left: s.start + STATS_WINDOW_MS - now,
  }
}

const UNITS = ['', '만', '억', '조', '경', '해', '자', '양'] as const

/** 피해를 벽과 같은 주로, 만 단위로 끊어 "1.2억주"처럼. */
export function sharesText(damage: number): string {
  let n = sharesOf(damage)
  if (n < 10_000) return `${n.toLocaleString('ko-KR')}주`
  let unit = 0
  let rest = 0
  while (n >= 10_000 && unit < UNITS.length - 1) {
    rest = n % 10_000
    n = Math.floor(n / 10_000)
    unit++
  }
  const small = Math.floor(rest / 1_000)
  return `${n.toLocaleString('ko-KR')}${small && n < 100 ? `.${small}` : ''}${UNITS[unit]}주`
}

/** 다음 창까지: "7분 12초". */
export function resetLeft(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(seconds / 60)
  const sec = seconds % 60
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`
}
