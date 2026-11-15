/**
 * The screen breaks the sell wall first and the server follows (decisions.md 532). This file is the
 * screen's copy of the server rule (IdleEngine.tick): the server's last state plus the hits it has
 * not handled yet gives the wall and health to show.
 */

/** IdleEngine.maxHp: the same curve, or the two sides disagree about when a wall breaks. */
export function idleMaxHp(wall: number) {
  const depth = wall - 1
  return (20 + 12 * depth + 0.2 * depth * depth) * (wall % 10 === 0 ? 3 : 1)
}

/** Hits the server never answered are forgotten after this long (decisions.md 497). */
export const IDLE_HIT_MS = 12000
/** The server keeps pierce damage for the two shown walls and four more (IdleEngine.FAR). */
const QUEUED = 6
/** Game seconds per real second (IdleEngine.SPEED). */
const SPEED = 2
/** Game seconds a circuit breaker lasts; it starts on walls 6, 16, 26… */
const CIRCUIT_SECONDS = 4
/** Game seconds of the server's halt that no longer stop a screen that already went on. */
const RESUMED_SECONDS = 1
/** The screen may run this many walls ahead of what the server confirms before it gives up. */
const SNAP_WALLS = 3
/** Hits on the same wall this close together are kept as one: a fast gun must not make the replay long. */
const MERGE_MS = 250
/** How finely time moves for the cache: expiry and the circuit countdown need no more. */
const TIME_STEP_MS = 50

export interface IdleWallHealth {
  wall: number
  hp: number
  maxHp: number
}

/** What the server says (company.idle). */
export interface IdleServer extends IdleWallHealth {
  upcoming?: IdleWallHealth[]
  circuitSeconds?: number
  sequence?: number
}

/** What the renderer and the HUD show. */
export interface IdleShown extends IdleWallHealth {
  upcoming: IdleWallHealth[]
  circuitSeconds: number
  sequence?: number
}

export interface IdleLocalHit {
  /** The wall the screen hit. Only pierced hits (depth 1, 2) are placed by it. */
  wall: number
  /** How many walls the bullet had already gone through: 0 is a direct hit. */
  depth: number
  damage: number
  at: number
  /** The heartbeat that carried it; undefined until it leaves (decisions.md 496). */
  sequence?: number
}

const circuitWall = (wall: number) => wall % 10 === 6

export class IdlePredictor {
  private hits: IdleLocalHit[] = []
  private version = 0
  /** The furthest progress shown so far: the shown wall and the damage on it never go back. */
  private floor: { wall: number; damage: number } | null = null
  /** The most damage shown on each wall behind the shown one. */
  private behind = new Map<number, number>()
  private serverWall = 0
  /** A circuit breaker the screen started before the server did. */
  private circuit: { wall: number; at: number } | null = null
  /** When the server's circuit time was first seen, to count it down between heartbeats. */
  private halt: { key: string; at: number } | null = null
  /** The wall whose halt has run out on this screen. */
  private resumed = 0
  private cache: { server: IdleServer; version: number; time: number; shown: IdleShown } | null =
    null
  private listeners = new Set<() => void>()
  private told = ''
  private telling = false

  add(hit: Omit<IdleLocalHit, 'at' | 'sequence'>, now = performance.now()) {
    if (!Number.isFinite(hit.damage) || hit.damage <= 0) return
    this.version++
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const old = this.hits[i]
      if (old.sequence !== undefined || now - old.at >= MERGE_MS) break
      if (old.wall !== hit.wall || old.depth !== hit.depth) continue
      old.damage += hit.damage
      return
    }
    this.hits.push({ wall: hit.wall, depth: hit.depth, damage: hit.damage, at: now })
  }

  /** Everything hit so far left with this heartbeat. */
  sent(sequence: number) {
    for (const hit of this.hits) hit.sequence ??= sequence
    this.version++
  }

  /** The server dropped the pending hits (stop, gap). What was shown stays shown. */
  clear() {
    this.hits = []
    // The server's circuit time stands still while no heartbeat runs: count it from the next look.
    this.halt = null
    this.version++
  }

  /** Another company or a fresh start: nothing shown so far counts. */
  reset() {
    this.clear()
    this.floor = null
    this.behind.clear()
    this.serverWall = 0
    this.circuit = null
    this.halt = null
    this.resumed = 0
    this.cache = null
  }

  /** The wall number and trading halt last shown, for the HUD. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  shownKey = () => this.told

  view(server: IdleServer, now = performance.now()): IdleShown {
    const time = Math.floor(now / TIME_STEP_MS)
    const cache = this.cache
    if (cache && cache.server === server && cache.version === this.version && cache.time === time)
      return cache.shown
    const shown = this.compute(server, now)
    this.cache = { server, version: this.version, time, shown }
    this.tell(`${shown.wall}:${shown.circuitSeconds > 0}`)
    return shown
  }

  private compute(server: IdleServer, now: number): IdleShown {
    const maxHp = (wall: number) =>
      wall === server.wall
        ? server.maxHp
        : (server.upcoming?.find((u) => u.wall === wall)?.maxHp ?? idleMaxHp(wall))
    const handled = server.sequence ?? -1
    const kept = this.hits.filter(
      (hit) =>
        hit.at >= now - IDLE_HIT_MS && (hit.sequence === undefined || hit.sequence > handled),
    )
    if (kept.length !== this.hits.length) this.hits = kept

    // The server's circuit time only moves with a heartbeat: count it down in between. Once it has
    // run out here, a late answer that still shows its last moments does not halt the screen again.
    let halted = server.circuitSeconds ?? 0
    if (halted > 0 && !(this.resumed === server.wall && halted <= RESUMED_SECONDS)) {
      const key = `${server.wall}:${handled}:${halted}`
      if (this.halt?.key !== key) this.halt = { key, at: now }
      halted = Math.max(0, halted - ((now - this.halt.at) / 1000) * SPEED)
      if (halted <= 0) this.resumed = server.wall
    } else {
      halted = 0
      this.halt = null
    }

    // Replay (IdleEngine.tick). Within a heartbeat the pierced hits land first, then the direct
    // hits as one stream of damage from the front wall on.
    let front = server.wall
    let damage = Math.max(0, server.maxHp - server.hp)
    const queued = Array.from({ length: QUEUED }, (_, i) => {
      const next = server.upcoming?.find((u) => u.wall === server.wall + 1 + i)
      return next ? Math.max(0, next.maxHp - next.hp) : 0
    })
    let stopped = false
    const breakWalls = () => {
      while (halted <= 0 && !stopped && damage + 1e-7 >= maxHp(front)) {
        const left = Math.max(0, damage - maxHp(front))
        front++
        damage = (queued.shift() ?? 0) + left
        queued.push(0)
        // A circuit breaker is never passed: what is left waits on that wall.
        if (circuitWall(front)) stopped = true
      }
    }
    breakWalls()
    for (let from = 0; from < this.hits.length && !stopped; ) {
      let to = from
      while (to < this.hits.length && this.hits[to].sequence === this.hits[from].sequence) to++
      let direct = 0
      for (const hit of this.hits.slice(from, to)) {
        if (hit.depth === 0) direct += hit.damage
        else {
          // A wall behind keeps its last point until it stands in front (decisions.md 520).
          const at = hit.wall - front - 1
          if (at >= 0 && at < QUEUED)
            queued[at] = Math.max(
              queued[at],
              Math.min(maxHp(hit.wall) - 1, queued[at] + hit.damage),
            )
        }
      }
      damage += direct
      breakWalls()
      from = to
    }

    // The screen's own circuit breaker: it starts at the break and waits for the server's.
    let circuitSeconds = halted
    if (stopped && front > server.wall) {
      if (this.circuit?.wall !== front) this.circuit = { wall: front, at: now }
      circuitSeconds = Math.max(0.05, CIRCUIT_SECONDS - ((now - this.circuit.at) / 1000) * SPEED)
    } else this.circuit = null

    // What was shown is never taken back (the debt): the shown wall just stops losing health until
    // the server's side has caught up. A long way ahead, or a server that went back, starts over.
    const floor = this.floor
    if (!floor || server.wall < this.serverWall || floor.wall - front > SNAP_WALLS) {
      this.floor = { wall: front, damage }
      this.behind.clear()
    } else if (front > floor.wall) {
      this.floor = { wall: front, damage: Math.max(damage, this.behind.get(front) ?? 0) }
    } else if (front === floor.wall) floor.damage = Math.max(floor.damage, damage)
    this.serverWall = server.wall
    const shown = this.floor ?? { wall: front, damage }
    for (const wall of this.behind.keys()) if (wall <= shown.wall) this.behind.delete(wall)
    const upcoming = [1, 2].map((ahead) => {
      const wall = shown.wall + ahead
      const predicted = wall === front ? damage : wall > front ? (queued[wall - front - 1] ?? 0) : 0
      const most = Math.min(maxHp(wall) - 1, Math.max(0, predicted, this.behind.get(wall) ?? 0))
      this.behind.set(wall, most)
      return { wall, hp: maxHp(wall) - most, maxHp: maxHp(wall) }
    })
    return {
      wall: shown.wall,
      hp: Math.max(0, maxHp(shown.wall) - shown.damage),
      maxHp: maxHp(shown.wall),
      upcoming,
      circuitSeconds,
      sequence: server.sequence,
    }
  }

  /** Listeners hear of a new wall or halt after the frame, never inside a React render. */
  private tell(state: string) {
    if (state === this.told) return
    this.told = state
    if (this.telling || this.listeners.size === 0) return
    this.telling = true
    queueMicrotask(() => {
      this.telling = false
      for (const listener of this.listeners) listener()
    })
  }
}
