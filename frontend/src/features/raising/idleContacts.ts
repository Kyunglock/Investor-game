export type IdleAttackKind = 'bullet' | 'water' | 'meteor' | 'bolt' | 'ram'
export interface IdleContact {
  wall: number
  kind: IdleAttackKind
  count: number
}

/** At most three walls × five attack kinds; draining prevents replay on the next heartbeat. */
export class IdleContacts {
  private hits = new Map<string, IdleContact>()

  add(wall: number, kind: IdleAttackKind, front: number) {
    if (!Number.isSafeInteger(wall) || wall < front || wall > front + 2) return
    const key = `${wall}:${kind}`
    const old = this.hits.get(key)
    if (old) old.count = Math.min(1000, old.count + 1)
    else if (this.hits.size < 15) this.hits.set(key, { wall, kind, count: 1 })
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
