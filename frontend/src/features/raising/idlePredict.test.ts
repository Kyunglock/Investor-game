import { describe, expect, it } from 'vitest'
import { IDLE_HIT_MS, IdlePredictor, type IdleServer, idleMaxHp } from './idlePredict'

/** The server's answer for a wall with `damage` on it and `queued` on the two walls behind. */
function server(
  wall: number,
  damage = 0,
  sequence = 0,
  queued = [0, 0],
  circuitSeconds = 0,
  more: Partial<IdleServer> = {},
) {
  return {
    ...more,
    wall,
    hp: Math.max(0, idleMaxHp(wall) - damage),
    maxHp: idleMaxHp(wall),
    upcoming: [1, 2].map((ahead) => ({
      wall: wall + ahead,
      hp: idleMaxHp(wall + ahead) - queued[ahead - 1],
      maxHp: idleMaxHp(wall + ahead),
    })),
    circuitSeconds,
    sequence,
  } satisfies IdleServer
}
const bullet = (wall: number, damage: number, depth = 0) => ({ wall, depth, damage })

describe('idleMaxHp', () => {
  it('is IdleEngine.maxHp: 20 + 12d + 0.2d², three times that on every tenth wall', () => {
    // Values from the Java formula (HP_BASE 20, HP_LINEAR 12, HP_SQUARE 0.2, BOSS_HP 3).
    expect(idleMaxHp(1)).toBe(20)
    expect(idleMaxHp(2)).toBeCloseTo(32.2, 9)
    expect(idleMaxHp(3)).toBeCloseTo(44.8, 9)
    expect(idleMaxHp(6)).toBe(85)
    expect(idleMaxHp(10)).toBeCloseTo(432.6, 9)
    expect(idleMaxHp(11)).toBe(160)
    expect(idleMaxHp(100)).toBeCloseTo(9504.6, 9)
    expect(idleMaxHp(201)).toBe(10420)
  })
})

describe('the screen breaks the wall first (decisions.md 532)', () => {
  it('shows the server state when nothing is pending', () => {
    const p = new IdlePredictor()
    expect(p.view(server(3, 10, 7, [4, 2]), 0)).toEqual({
      wall: 3,
      hp: idleMaxHp(3) - 10,
      maxHp: idleMaxHp(3),
      upcoming: [
        { wall: 4, hp: idleMaxHp(4) - 4, maxHp: idleMaxHp(4) },
        { wall: 5, hp: idleMaxHp(5) - 2, maxHp: idleMaxHp(5) },
      ],
      circuitSeconds: 0,
      sequence: 7,
      serial: 3,
    })
  })

  it('breaks at the hit and carries what is left into the next wall', () => {
    const p = new IdlePredictor()
    const s = server(1, 15)
    expect(p.view(s, 0).hp).toBe(5)
    p.add(bullet(1, 3), 10)
    expect(p.view(s, 10)).toMatchObject({ wall: 1, hp: 2 })
    p.add(bullet(1, 9), 20)
    const shown = p.view(s, 20)
    expect(shown.wall).toBe(2)
    expect(shown.hp).toBeCloseTo(idleMaxHp(2) - 7, 9)
    expect(shown.maxHp).toBe(idleMaxHp(2))
    expect(shown.upcoming.map((u) => u.wall)).toEqual([3, 4])
  })

  it('breaks several walls with one big hit', () => {
    const p = new IdlePredictor()
    p.add(bullet(1, 20 + idleMaxHp(2) + idleMaxHp(3) + 5), 0)
    const shown = p.view(server(1), 0)
    expect(shown.wall).toBe(4)
    expect(shown.hp).toBeCloseTo(idleMaxHp(4) - 5, 9)
  })

  it('adds pierced hits to the wall they name, never past its last point', () => {
    const p = new IdlePredictor()
    const s = server(1, 0, 0, [3, 0])
    p.add(bullet(2, 4, 1), 0)
    p.add(bullet(3, 2, 2), 0)
    expect(p.view(s, 0).upcoming).toEqual([
      { wall: 2, hp: idleMaxHp(2) - 7, maxHp: idleMaxHp(2) },
      { wall: 3, hp: idleMaxHp(3) - 2, maxHp: idleMaxHp(3) },
    ])
    p.add(bullet(2, 1000, 1), 1)
    expect(p.view(s, 100).upcoming[0].hp).toBe(1)
    // The pierced wall starts with that damage when it comes to the front, plus the leftover.
    p.add(bullet(1, 21), 2)
    const shown = p.view(s, 200)
    expect(shown.wall).toBe(3)
    expect(shown.hp).toBeCloseTo(idleMaxHp(3) - 2, 9)
  })

  it('forgets handled hits without the health moving', () => {
    const p = new IdlePredictor()
    p.add(bullet(1, 6), 0)
    p.add(bullet(2, 1, 1), 0)
    const before = p.view(server(1, 0, 4), 0)
    expect(before.hp).toBe(14)
    p.sent(5)
    p.add(bullet(1, 2), 100)
    expect(p.view(server(1, 0, 4), 100).hp).toBe(12)
    // Beat 5 handled: its hits are in the server's numbers now, the later one is still on top.
    const after = p.view(server(1, 6, 5, [1, 0]), 200)
    expect(after.hp).toBe(12)
    expect(after.upcoming[0].hp).toBe(idleMaxHp(2) - 1)
    p.sent(6)
    expect(p.view(server(1, 8, 6, [1, 0]), 300).hp).toBe(12)
  })

  it('forgets hits the server never answered after 12 seconds', () => {
    const p = new IdlePredictor()
    const s = server(5)
    p.add(bullet(5, 6), 0)
    p.sent(1)
    expect(p.view(s, IDLE_HIT_MS - 100).hp).toBe(idleMaxHp(5) - 6)
    p.add(bullet(5, 1), IDLE_HIT_MS)
    // The old hit is gone; what was shown stays, so the new hit does not show until it is made up.
    expect(p.view(s, IDLE_HIT_MS + 100).hp).toBe(idleMaxHp(5) - 6)
  })

  it('never takes back a broken wall when the server credits less (the debt)', () => {
    const p = new IdlePredictor()
    p.add(bullet(1, 25), 0)
    p.sent(1)
    expect(p.view(server(1, 0, 0), 0)).toMatchObject({ wall: 2, hp: idleMaxHp(2) - 5 })
    // The server took 12 of the 25: wall 1 still stands there with 8 left.
    const short = server(1, 12, 1)
    expect(p.view(short, 100)).toMatchObject({ wall: 2, hp: idleMaxHp(2) - 5 })
    // New hits pay the debt first (8 on wall 1, then 5 on wall 2): the shown health does not move…
    p.add(bullet(2, 6), 200)
    expect(p.view(short, 200)).toMatchObject({ wall: 2, hp: idleMaxHp(2) - 5 })
    p.add(bullet(2, 7), 300)
    expect(p.view(short, 300)).toMatchObject({ wall: 2, hp: idleMaxHp(2) - 5 })
    // …and goes down again once the server's side has caught up.
    p.add(bullet(2, 4), 400)
    const shown = p.view(short, 400)
    expect(shown.wall).toBe(2)
    expect(shown.hp).toBeCloseTo(idleMaxHp(2) - 9, 9)
  })

  it('keeps what was shown when the pending hits are dropped', () => {
    const p = new IdlePredictor()
    const s = server(1, 0, 0, [0, 0])
    p.add(bullet(1, 25), 0)
    p.add(bullet(3, 3, 1), 0)
    const shown = p.view(s, 0)
    p.clear()
    expect(p.view(s, 100)).toEqual(shown)
    // The same server with new hits: the wall behind does not get its health back either.
    expect(p.view({ ...s }, 200).upcoming[0].hp).toBe(idleMaxHp(3) - 3)
  })

  it('goes back to the server when the screen is more than three walls ahead', () => {
    const p = new IdlePredictor()
    const s = server(1)
    p.add(bullet(1, 20 + idleMaxHp(2) + idleMaxHp(3)), 0)
    expect(p.view(s, 0).wall).toBe(4)
    p.clear()
    expect(p.view(s, 100).wall).toBe(4)
    const q = new IdlePredictor()
    q.add(bullet(1, 20 + idleMaxHp(2) + idleMaxHp(3) + idleMaxHp(4)), 0)
    expect(q.view(s, 0).wall).toBe(5)
    q.clear()
    expect(q.view(s, 100)).toMatchObject({ wall: 1, hp: 20 })
  })

  it('follows a server wall that went back (jump tool, new company)', () => {
    const p = new IdlePredictor()
    expect(p.view(server(40, 100), 0).wall).toBe(40)
    expect(p.view(server(39, 5), 100)).toMatchObject({ wall: 39, hp: idleMaxHp(39) - 5 })
    expect(p.view(server(200), 200).wall).toBe(200)
    p.reset()
    expect(p.view(server(2), 300).wall).toBe(2)
  })

  it('lets the wall before a boss stand again under the same number (decisions.md 546)', () => {
    const p = new IdlePredictor()
    const s = server(9, 0, 0, [0, 0], 0, { cleared: 40, epoch: 2 })
    expect(p.view(s, 0)).toMatchObject({ wall: 9, serial: 40 })
    p.add(bullet(9, idleMaxHp(9) + 5), 10)
    // Broken: a new wall 9 with what was left of the hit on it. The boss is not entered.
    const again = p.view(s, 10)
    expect(again).toMatchObject({ wall: 9, serial: 41 })
    expect(again.hp).toBeCloseTo(idleMaxHp(9) - 5, 9)
    expect(again.upcoming.map((u) => u.wall)).toEqual([10, 11])
    p.add(bullet(9, idleMaxHp(9) * 2), 20)
    expect(p.view(s, 20)).toMatchObject({ wall: 9, serial: 43 })
    // The server's answer for the same breaks changes nothing shown.
    p.sent(1)
    const caught = p.view(server(9, 5, 1, [0, 0], 0, { cleared: 43, epoch: 2 }), 30)
    expect(caught).toMatchObject({ wall: 9, serial: 43 })
    expect(caught.hp).toBeCloseTo(idleMaxHp(9) - 5, 9)
  })

  it('starts over when the fight moved without a break: retreat, boss challenge (546)', () => {
    const p = new IdlePredictor()
    const before = server(9, 0, 0, [0, 0], 0, { cleared: 40, epoch: 2 })
    p.add(bullet(9, idleMaxHp(9) + 5), 0)
    expect(p.view(before, 0).serial).toBe(41)
    p.clear()
    // The boss challenge: wall 10 with nothing on it, although fewer walls are counted broken.
    const boss = server(10, 0, 1, [0, 0], 0, { cleared: 40, epoch: 3 })
    expect(p.view(boss, 100)).toMatchObject({ wall: 10, hp: idleMaxHp(10), serial: 40 })
    // The buy wall fell there: ten walls back.
    const back = server(1, 0, 2, [0, 0], 0, { cleared: 40, epoch: 4 })
    expect(p.view(back, 200)).toMatchObject({ wall: 1, hp: 20, serial: 40 })
  })

  it('halts the boss wall once at half health and waits for the server (546)', () => {
    const p = new IdlePredictor()
    const half = idleMaxHp(10) / 2
    const s = server(10, half - 5, 0, [0, 0], 0, { cleared: 9, epoch: 1, circuitFired: false })
    expect(p.view(s, 0).circuitSeconds).toBe(0)
    // The hit that reaches half halts trading here, before the server knows.
    p.add(bullet(10, 5 + half + 30), 1000)
    expect(p.view(s, 1000)).toMatchObject({ wall: 10, circuitSeconds: 4 })
    expect(p.view(s, 2000).circuitSeconds).toBe(2)
    // It does not run out before the server has halted too.
    expect(p.view(s, 9000).circuitSeconds).toBeGreaterThan(0)
    // The server's halt, then the wall breaks with what waited on it.
    p.sent(1)
    const halted = server(10, half * 2 + 30, 1, [0, 0], 4, {
      cleared: 9,
      epoch: 1,
      circuitFired: true,
    })
    expect(p.view(halted, 10000)).toMatchObject({ wall: 10, circuitSeconds: 4 })
    const resumed = server(11, 30, 2, [0, 0], 0, { cleared: 10, epoch: 1, circuitFired: false })
    const shown = p.view(resumed, 12000)
    expect(shown).toMatchObject({ wall: 11, circuitSeconds: 0, serial: 10 })
    expect(shown.hp).toBeCloseTo(idleMaxHp(11) - 30, 9)
  })

  it('does not halt a boss wall whose circuit breaker already ran (546)', () => {
    const p = new IdlePredictor()
    const half = idleMaxHp(10) / 2
    const s = server(10, half + 1, 0, [0, 0], 0, { cleared: 9, epoch: 1, circuitFired: true })
    p.add(bullet(10, half), 0)
    expect(p.view(s, 0)).toMatchObject({ wall: 11, circuitSeconds: 0 })
  })

  it.each([6, 16])('does not start a circuit breaker at wall %i (decisions.md 533)', (wall) => {
    const p = new IdlePredictor()
    const s = server(wall - 1)
    p.add(bullet(wall - 1, idleMaxHp(wall - 1) + idleMaxHp(wall) + 50), 1000)
    const shown = p.view(s, 1000)
    // What is left goes on past the wall that used to halt trading.
    expect(shown).toMatchObject({ wall: wall + 1, circuitSeconds: 0 })
    expect(shown.hp).toBeCloseTo(idleMaxHp(wall + 1) - 50, 9)
  })

  it('does not halt again for the last moments of a halt that ran out here', () => {
    const p = new IdlePredictor()
    expect(p.view(server(6, 0, 1, [0, 0], 4), 0).circuitSeconds).toBe(4)
    expect(p.view(server(6, 0, 2, [0, 0], 2), 1000).circuitSeconds).toBe(2)
    expect(p.view(server(6, 0, 2, [0, 0], 2), 2000).circuitSeconds).toBe(0)
    // An answer made just before the server's halt ended arrives after the screen went on.
    expect(p.view(server(6, 0, 3, [0, 0], 0.2), 2050).circuitSeconds).toBe(0)
    // A halt that really is still on (the heartbeat stood still) stops the screen again.
    expect(p.view(server(6, 0, 4, [0, 0], 3), 2100).circuitSeconds).toBe(3)
    // The next circuit wall halts as usual.
    expect(p.view(server(16, 0, 9, [0, 0], 0.5), 9000).circuitSeconds).toBe(0.5)
  })

  it('does not break walls while the server is halted', () => {
    const p = new IdlePredictor()
    const s = server(6, 80, 2, [0, 0], 4)
    p.add(bullet(6, 30), 0)
    expect(p.view(s, 0)).toMatchObject({ wall: 6, hp: 0, circuitSeconds: 4 })
  })

  it('tells listeners when the shown wall changes, after the frame', async () => {
    const p = new IdlePredictor()
    let told = 0
    p.subscribe(() => told++)
    const s = server(1)
    p.view(s, 0)
    await Promise.resolve()
    const first = told
    p.add(bullet(1, 1), 0)
    p.view(s, 100)
    await Promise.resolve()
    expect(told).toBe(first)
    p.add(bullet(1, 30), 0)
    p.view(s, 200)
    expect(told).toBe(first)
    await Promise.resolve()
    expect(told).toBe(first + 1)
  })

  it('keeps the hits of a fast gun on one wall as one, until they leave with a heartbeat', () => {
    const p = new IdlePredictor()
    const s = server(1)
    for (let i = 0; i < 10; i++) {
      p.add(bullet(1, 0.5), i * 20)
      p.add(bullet(2, 0.25, 1), i * 20)
    }
    expect(p.view(s, 200)).toMatchObject({ wall: 1, hp: 15 })
    expect(p.view(s, 200).upcoming[0].hp).toBe(idleMaxHp(2) - 2.5)
    p.sent(1)
    p.add(bullet(1, 1), 210)
    // Beat 1 handled: only the hit made after it left is still on top.
    expect(p.view(server(1, 5, 1, [2.5, 0]), 300).hp).toBe(14)
  })

  it('answers from its cache while nothing changed', () => {
    const p = new IdlePredictor()
    const s = server(1)
    expect(p.view(s, 1000)).toBe(p.view(s, 1010))
    p.add(bullet(1, 1), 1010)
    expect(p.view(s, 1010).hp).toBe(19)
  })
})
