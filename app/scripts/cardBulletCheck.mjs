import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5307/app/')
  await page.evaluate(async () => {
    const [{ startBattle }, { stageSpec }, { loadoutOf }, { DEFAULT_WEAPON }] = await Promise.all([
      import('/app/src/mental/battle.ts'),
      import('/app/src/mental/advance.ts'),
      import('/app/src/mental/cards.ts'),
      import('/app/src/mental/hero.ts'),
    ])
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    const loadout = {
      ...loadoutOf(DEFAULT_WEAPON),
      maxMental: 10000,
      fireMs: 80,
      mates: 2,
      damage: 2,
    }
    window.cardLevel = 0
    const handle = startBattle(host, {
      mode: 'defense',
      stage: stageSpec(1),
      genre: 'DEFENSE',
      hero: { name: 'test', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      onHud: () => {},
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: (level) => {
        window.cardLevel = level
        if (level === 1 || window.cardPicked) setTimeout(() => handle.applyLoadout(loadout), 0)
      },
    })
    window.pickCard = () => {
      window.cardPicked = true
      handle.applyLoadout({ ...loadout, damage: 2.2 })
    }
    window.pauseBattle = (flag) => handle.setPaused(flag)
  })
  await page.waitForFunction(() => window.cardLevel >= 2, null, { timeout: 45000 })
  const before = await page.evaluate(() => window.__mentalMarket())
  const saved = before.projectiles.filter((b) => b.remainingMs > 200)
  assert(saved.length > 0, 'a real level-up must leave projectiles in flight')
  await page.waitForTimeout(2500)
  const paused = await page.evaluate(() => window.__mentalMarket())
  assert.equal(paused.battleSeconds, before.battleSeconds)
  for (const b of saved) {
    const still = paused.projectiles.find((p) => p.id === b.id)
    assert.equal(still.x, b.x)
    assert.equal(still.y, b.y)
    assert.equal(still.remainingMs, b.remainingMs)
  }
  await page.evaluate(() => window.pickCard())
  await page.waitForTimeout(45)
  const resumed = await page.evaluate(() => window.__mentalMarket())
  assert(
    saved.some((b) =>
      resumed.projectiles.some((p) => p.id === b.id && p.expiresAt === b.expiresAt),
    ),
    'projectiles must survive card selection longer than their lifetime',
  )
  // Wait for an actual new shot; a fixed snapshot can fall between targets.
  await page.waitForFunction(
    (expiry) => {
      if (!window.__mentalMarket().projectiles.some((b) => b.expiresAt > expiry)) return false
      window.pauseBattle(true)
      return true
    },
    Math.max(...saved.map((b) => b.expiresAt)),
    { timeout: 10000 },
  )
  const pauseStart = await page.evaluate(() => window.__mentalMarket())
  await page.waitForTimeout(1200)
  const pauseEnd = await page.evaluate(() => window.__mentalMarket())
  assert.deepEqual(
    pauseEnd.projectiles,
    pauseStart.projectiles,
    'pause also freezes bullet lifetime',
  )
  await page.evaluate(() => window.pauseBattle(false))
  assert.deepEqual(errors, [])
  console.log('PASS: real card selection preserves in-flight bullets and resumes firing')
} finally {
  await browser.close()
}
