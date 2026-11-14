export type IdleAttackKind = 'bullet' | 'water' | 'meteor' | 'bolt' | 'ram' | 'barrage' | 'buy'
export interface IdleContact {
  wall: number
  kind: IdleAttackKind
  count: number
  damage: number
}

/** At most three walls × seven attack kinds; draining prevents replay on the next heartbeat. */
export class IdleContacts {
  private hits = new Map<string, IdleContact>()

  add(wall: number, kind: IdleAttackKind, front: number, damage: number) {
    if (!Number.isSafeInteger(wall) || wall < front || wall > front + 2) return
    if (!Number.isFinite(damage) || damage <= 0) return
    const key = `${wall}:${kind}`
    const old = this.hits.get(key)
    if (old && old.count < 1000) {
      old.count++
      old.damage += damage
    } else if (!old && this.hits.size < 21) this.hits.set(key, { wall, kind, count: 1, damage })
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
