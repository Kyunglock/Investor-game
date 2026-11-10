import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: Number(process.env.BARRIER_WIDTH ?? 390), height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference',
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5307/app/')
  await page.evaluate(async () => {
    const [
      { startBattle },
      { assaultSpec },
      { loadoutOf },
      { DEFAULT_WEAPON },
      { CIRCUIT_BREAKER },
    ] = await Promise.all([
      import('/app/src/mental/battle.ts'),
      import('/app/src/mental/assault.ts'),
      import('/app/src/mental/cards.ts'),
      import('/app/src/mental/hero.ts'),
      import('/app/src/mental/circuitBreaker.ts'),
    ])
    // Exercise the real circuit path at the first wall in this browser-only test.
    CIRCUIT_BREAKER.afterWalls[0] = 0
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    const loadout = {
      ...loadoutOf(DEFAULT_WEAPON),
      maxMental: 10000,
      damage: 0.1,
      fireMs: 120,
      bulletSpeed: 180,
    }
    const assault = assaultSpec(1)
    assault.walls = assault.walls.map((w) => ({ ...w, cellHp: 100000 }))
    const handle = startBattle(host, {
      mode: 'assault',
      assault,
      genre: 'DEFENSE',
      hero: { name: 'test', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      onHud: (hud) => {
        window.hud = hud
      },
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: () => setTimeout(() => handle.applyLoadout(loadout), 0),
    })
    window.pauseBarrier = (flag) => handle.setPaused(flag)
  })
  await page.waitForFunction(() => window.hud)
  await page.waitForFunction(() => window.__mentalMarket().circuit?.elapsed > 0.3, null, {
    timeout: 30000,
  })
  const start = await page.evaluate(() => window.__mentalMarket())
  assert(start.projectiles.length > 0)
  await page.evaluate(() => window.pauseBarrier(true))
  const paused = await page.evaluate(() => window.__mentalMarket())
  await page.waitForTimeout(200)
  assert.deepEqual(await page.evaluate(() => window.__mentalMarket()), paused)
  await page.evaluate(() => window.pauseBarrier(false))
  await page.waitForFunction(() => window.__mentalMarket().circuit?.elapsed > 3.1)
  const held = await page.evaluate(() => window.__mentalMarket())
  assert.deepEqual(held.projectiles, start.projectiles, 'cat bullets and their lifetime freeze')
  assert.equal(held.battleSeconds, start.battleSeconds)
  assert(held.circuit.queuedSell > 0 && held.circuit.queuedBuy > 0)
  assert(held.buyWall.sells - start.buyWall.sells <= 2, 'slow sell inflow')
  assert(held.buyWall.shots - start.buyWall.shots <= 4, 'slow buy inflow')
  for (const old of start.sellOrders)
    assert(
      held.sellOrders.some((e) => e.id === old.id),
      'sell order retained',
    )
  assert(
    held.buyWall.feedback.orders.length >= start.buyWall.feedback.orders.length,
    'buy orders retained',
  )
  if (process.env.BARRIER_SHOT) {
    await page.evaluate(() => window.pauseBarrier(true))
    await page.screenshot({ path: process.env.BARRIER_SHOT })
    await page.evaluate(() => window.pauseBarrier(false))
  }
  await page.waitForFunction(() => !window.__mentalMarket().circuit)
  await page.waitForTimeout(150)
  const released = await page.evaluate(() => window.__mentalMarket())
  assert(!released.physicsPaused)
  assert(released.battleSeconds > held.battleSeconds)
  assert(
    held.sellOrders.some((old) =>
      released.sellOrders.some((e) => e.id === old.id && e.y > old.y + 1),
    ),
    'sells leave queue',
  )
  assert(
    released.buyWall.feedback.orders.some((e) => e.y < held.circuit.barrier.y + 54),
    'buys leave queue',
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: circuit barrier queues both sides, freezes bullets, pauses and releases retained orders',
  )
} finally {
  await browser.close()
}
