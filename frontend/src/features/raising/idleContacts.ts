export type IdleAttackKind =
  | 'bullet'
  | 'water'
  | 'meteor'
  | 'bolt'
  | 'ram'
  | 'ice'
  | 'wind'
  | 'barrage'
  | 'buy'
export interface IdleContact {
  wall: number
  kind: IdleAttackKind
  /** How many walls the bullet had already gone through (decisions.md 520, 532): 0 is a direct hit. */
  depth: number
  count: number
  damage: number
}

/** The API takes this many entries in one heartbeat (IdleHit maxItems). */
const MOST = 60

/**
 * What the screen hit since the last heartbeat, batched by wall, kind and depth; draining prevents
 * replay on the next heartbeat. `add` says whether the hit will be sent: the screen only shows
 * damage the server is going to hear of.
 */
export class IdleContacts {
  private hits = new Map<string, IdleContact>()

  add(wall: number, kind: IdleAttackKind, depth: number, damage: number) {
    if (!Number.isSafeInteger(wall) || wall < 1) return false
    if (depth !== 0 && depth !== 1 && depth !== 2) return false
    // Only a bullet's pierce reaches the walls behind (decisions.md 520).
    if (depth > 0 && kind !== 'bullet') return false
    if (!Number.isFinite(damage) || damage <= 0) return false
    const key = `${wall}:${kind}:${depth}`
    let old = this.hits.get(key)
    if (!old && this.hits.size >= MOST) {
      // Walls falling faster than the list can name them: direct hits are one stream of damage
      // whatever wall they name (532), so the hit joins the latest entry of its kind.
      if (depth > 0) return false
      for (const hit of this.hits.values()) if (hit.kind === kind && hit.depth === 0) old = hit
      if (!old) return false
    }
    if (!old) {
      this.hits.set(key, { wall, kind, depth, count: 1, damage })
      return true
    }
    if (old.count >= 1000) return false
    old.count++
    old.damage += damage
    return true
  }

  drain() {
    const hits = [...this.hits.values()]
    this.hits.clear()
    return hits
  }

  clear() {
    this.hits.clear()
  }
}
