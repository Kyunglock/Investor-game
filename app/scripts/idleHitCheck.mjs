// Real Phaser contacts: time alone must never create damage reports, and rear hits need area overlap.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/')
  await page.locator('[data-testid=idle-canvas] canvas').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
  )
  await page.evaluate(async () => {
    const base = '/app/src/mental/'
    const [{ startBattle }, { loadoutOf }, { assaultSpec }, { DEFAULT_WEAPON }] = await Promise.all(
      [
        import(`${base}battle.ts`),
        import(`${base}cards.ts`),
        import(`${base}assault.ts`),
        import(`${base}hero.ts`),
      ],
    )
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    const spec = assaultSpec(1)
    spec.walls = [{ ...spec.walls[0], rows: 1, spawnSeconds: 10000 }]
    const loadout = { ...loadoutOf(DEFAULT_WEAPON), fireMs: 100000, damage: 0.5 }
    const snapshot = {
      wall: 16,
      hp: 5000,
      maxHp: 5000,
      upcoming: [
        { wall: 17, hp: 5000, maxHp: 5000 },
        { wall: 18, hp: 5000, maxHp: 5000 },
      ],
    }
    window.actualIdleHits = []
    const handle = startBattle(host, {
      mode: 'assault',
      speed: 2,
      assault: spec,
      genre: 'DEFENSE',
      hero: { name: '명중검증', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      idle: () => snapshot,
      onIdleHit: (wall, kind, damage) => window.actualIdleHits.push({ wall, kind, damage }),
      onHud: () => {},
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: () => handle.applyLoadout(loadout),
    })
    window.enableIdleAttacks = (meteor = 1, fireMs = 100) =>
      handle.applyLoadout({ ...loadout, fireMs, meteor })
    window.pauseIdleTest = (paused) => handle.setPaused(paused)
    window.stopIdleTest = () => handle.stop()
    window.idleHitsSent = (sequence) => handle.idleHitsSent(sequence)
    window.clearIdleHits = () => handle.clearIdleHits()
    // The server handled this beat: its health now holds `damage`.
    window.idleServer = (sequence, damage) => {
      snapshot.sequence = sequence
      snapshot.hp -= damage
    }
  })
  await page.waitForFunction(() => window.__mentalWalls?.()[0]?.arrived)
  await page.waitForFunction(() => window.__mentalMarket().battleSeconds > 3)
  assert.deepEqual(await page.evaluate(() => window.actualIdleHits), [])
  await page.evaluate(() => window.enableIdleAttacks())
  await page.waitForFunction(() =>
    window.actualIdleHits.some((h) => h.wall === 16 && h.kind === 'bullet'),
  )
  await page.waitForFunction(() =>
    window.actualIdleHits.some((h) => h.wall === 17 && h.kind === 'meteor'),
  )
  assert.equal(await page.evaluate(() => window.actualIdleHits.some((h) => h.wall === 18)), false)
  await page.evaluate(() => window.enableIdleAttacks(5))
  await page.waitForFunction(() =>
    window.actualIdleHits.some((h) => h.wall === 18 && h.kind === 'meteor'),
  )
  const hits = await page.evaluate(() => window.actualIdleHits)
  assert(hits.every((hit) => hit.wall === 16 || hit.kind === 'meteor'))
  // A bullet is twice the weapon's damage (decisions.md 495), or twice that again on a pistol
  // critical (487).
  assert(
    hits
      .filter((hit) => hit.kind === 'bullet')
      .every((hit) => hit.damage === 1 || hit.damage === 2),
  )
  assert(
    hits.filter((hit) => hit.kind === 'meteor').every((hit) => hit.damage > 0 && hit.damage <= 2.4),
  )
  // The renderer cannot clear a wall by itself. It only shows hits ahead of the server
  // (decisions.md 493) and forgets them when the server has handled the beat that carried them
  // (496), not after a fixed time: the shown health must never bounce back up meanwhile.
  const wallHp = async () => (await page.evaluate(() => window.__mentalWalls()))[0].hp
  const shown = await wallHp()
  assert(shown > 4900 && shown < 5000, `predicted health ${shown}`)
  await page.evaluate(() => window.pauseIdleTest(true))
  const pausedCount = await page.evaluate(() => window.actualIdleHits.length)
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(() => window.actualIdleHits.length), pausedCount)
  await page.evaluate(() => window.pauseIdleTest(false))
  await page.evaluate(() => window.enableIdleAttacks(0, 100000))
  await page.waitForTimeout(1000)
  // Start from fresh hits so the last-resort timeout (5 s without any answer) stays out of the way.
  await page.evaluate(() => window.clearIdleHits())
  await page.waitForTimeout(100)
  assert.equal(await wallHp(), 5000)
  await page.evaluate(() => window.enableIdleAttacks(0, 100))
  await page.waitForFunction(() => window.__mentalWalls()[0].hp < 4999.5)
  await page.evaluate(() => window.enableIdleAttacks(0, 100000))
  await page.waitForTimeout(700)
  const predicted = await wallHp()
  assert(predicted < 5000, `predicted health ${predicted}`)
  // Beat 1 leaves with those hits. A slow answer (longer than the old 1.4 s) changes nothing.
  await page.evaluate(() => window.idleHitsSent(1))
  await page.waitForTimeout(1800)
  assert.equal(await wallHp(), predicted, 'health rose before the server answered')
  // The answer already holds the damage: it is not taken off twice, so nothing moves.
  await page.evaluate((damage) => window.idleServer(1, damage), 5000 - predicted)
  await page.waitForTimeout(300)
  assert(Math.abs((await wallHp()) - predicted) < 1e-6, 'health moved when the server caught up')
  // A dropped batch (stop, gap) is forgotten at once: back to the server's value.
  await page.evaluate(() => window.enableIdleAttacks(0, 100))
  await page.waitForFunction((hp) => window.__mentalWalls()[0].hp < hp - 0.5, predicted)
  await page.evaluate(() => window.enableIdleAttacks(0, 100000))
  await page.waitForTimeout(700)
  await page.evaluate(() => window.clearIdleHits())
  await page.waitForTimeout(100)
  assert(Math.abs((await wallHp()) - predicted) < 1e-6, 'dropped hits stayed off the wall')
  await page.evaluate(() => window.pauseIdleTest(true))
  // Boss health must be independent from wall health, including its death effect.
  await page.evaluate(async () => {
    window.stopIdleTest()
    const base = '/app/src/mental/'
    const [{ startBattle }, { loadoutOf }, { assaultSpec }, { DEFAULT_WEAPON }] = await Promise.all(
      ['battle.ts', 'cards.ts', 'assault.ts', 'hero.ts'].map((file) => import(base + file)),
    )
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    const spec = assaultSpec(1)
    spec.walls = [{ ...spec.walls[0], rows: 1, boss: true, spawnSeconds: 10000 }]
    spec.bossHp = 3
    const loadout = { ...loadoutOf(DEFAULT_WEAPON), fireMs: 100, damage: 0.5 }
    window.actualIdleHits = []
    let sawBoss = false
    window.bossTestDone = false
    const handle = startBattle(host, {
      mode: 'assault',
      speed: 2,
      assault: spec,
      genre: 'DEFENSE',
      hero: { name: '큰손 검증', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      idle: () => ({ wall: 10, hp: 5000, maxHp: 5000 }),
      onIdleHit: (wall, kind) => window.actualIdleHits.push({ wall, kind }),
      onHud: () => {
        const boss = window.__mentalMarket?.().boss
        if (boss) sawBoss = true
        if (sawBoss && !boss && !window.bossTestDone) {
          window.bossTestDone = true
          handle.setPaused(true)
        }
      },
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: () => handle.applyLoadout(loadout),
    })
  })
  await page.waitForFunction(() => window.bossTestDone)
  assert.deepEqual(await page.evaluate(() => window.actualIdleHits), [])
  assert.equal((await page.evaluate(() => window.__mentalWalls()))[0].hp, 5000)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: no timer contacts, real bullet/area contacts, no health bounce, independent boss, pause',
  )
} finally {
  await browser.close()
}
