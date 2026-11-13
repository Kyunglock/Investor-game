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
      onIdleHit: (wall, kind) => window.actualIdleHits.push({ wall, kind }),
      onHud: () => {},
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: () => handle.applyLoadout(loadout),
    })
    window.enableIdleAttacks = (meteor = 1) =>
      handle.applyLoadout({ ...loadout, fireMs: 100, meteor })
    window.pauseIdleTest = (paused) => handle.setPaused(paused)
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
  // The renderer cannot clear a wall by itself; the server snapshot still has full health.
  assert.equal((await page.evaluate(() => window.__mentalWalls()))[0].hp, 5000)
  await page.evaluate(() => window.pauseIdleTest(true))
  const pausedCount = await page.evaluate(() => window.actualIdleHits.length)
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(() => window.actualIdleHits.length), pausedCount)
  assert.deepEqual(errors, [])
  console.log('PASS: no timer contacts, real bullet/area contacts, no client clear, pause')
} finally {
  await browser.close()
}
