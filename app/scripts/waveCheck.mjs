import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  for (const mode of ['defense', 'assault']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5307/app/')
    await page.evaluate(async (mode) => {
      const [{ startBattle }, { stageSpec }, { assaultSpec }, { loadoutOf }, { DEFAULT_WEAPON }] =
        await Promise.all([
          import('/app/src/mental/battle.ts'),
          import('/app/src/mental/advance.ts'),
          import('/app/src/mental/assault.ts'),
          import('/app/src/mental/cards.ts'),
          import('/app/src/mental/hero.ts'),
        ])
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;inset:0;z-index:99999'
      document.body.append(host)
      // Survive long enough to observe all three waves without skipping walls.
      const loadout = { ...loadoutOf(DEFAULT_WEAPON), maxMental: 100000, damage: 0.1 }
      const assault = assaultSpec(1)
      assault.walls = assault.walls.map((w) => ({ ...w, cellHp: 100000 }))
      window.waves = []
      const handle = startBattle(host, {
        mode,
        stage: stageSpec(1),
        assault,
        genre: 'DEFENSE',
        hero: { name: 'test', weapon: DEFAULT_WEAPON, upgrades: [] },
        loadout,
        onHud: (hud) => {
          window.hud = hud
        },
        onBanner: (text) => {
          if (text.includes('웨이브!')) window.waves.push(text.split(' ')[0])
        },
        onHurt: () => {},
        onLevelUp: () => setTimeout(() => handle.applyLoadout(loadout), 0),
        onDone: () => {},
      })
      window.pauseWaves = () => handle.setPaused(true)
    }, mode)
    await page.waitForFunction(() => window.hud)
    await page.evaluate(() => window.__mentalSpeed(6))
    await page.waitForFunction(() => window.waves.length >= 3, null, { timeout: 30000 })
    assert.deepEqual(await page.evaluate(() => window.waves.slice(0, 3)), [
      '패닉셀',
      '투매',
      '공매도',
    ])
    await page.waitForTimeout(600)
    await page.evaluate(() => window.pauseWaves())
    if (process.env.WAVE_SHOT_DIR)
      await page.screenshot({ path: `${process.env.WAVE_SHOT_DIR}/${mode}-waves.png` })
    assert.deepEqual(errors, [])
    console.log(`PASS: ${mode} panic / dump / short-selling waves`)
    await page.close()
  }
} finally {
  await browser.close()
}
