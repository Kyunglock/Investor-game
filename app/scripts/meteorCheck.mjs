import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

mkdirSync('/tmp/meteor-shots', { recursive: true })
const browser = await chromium.launch()
try {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    for (const mode of ['defense', 'assault']) {
      const page = await browser.newPage({ viewport: { width, height } })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (r) => r.fulfill({ json: company }))
      await page.goto('http://127.0.0.1:5182/app/')
      await page.evaluate(async (mode) => {
        const base = '/app/src/mental/'
        const [{ startBattle }, cards, { DEFAULT_WEAPON }] = await Promise.all([
          import(`${base}battle.ts`),
          import(`${base}cards.ts`),
          import(`${base}hero.ts`),
        ])
        const host = document.createElement('div')
        host.style.cssText = 'position:fixed;inset:0;z-index:99999'
        document.body.append(host)
        const loadout = {
          ...cards.loadoutOf(DEFAULT_WEAPON),
          damage: 0.5,
          fireMs: 100000,
          maxMental: 100000,
          meteor: 1,
        }
        const handle = startBattle(host, {
          mode,
          genre: 'DEFENSE',
          hero: { name: '사장냥', weapon: DEFAULT_WEAPON, upgrades: [] },
          loadout,
          onHud: () => {},
          onBanner: () => {},
          onHurt: () => {},
          onDone: () => {},
          onLevelUp: () => setTimeout(() => handle.applyLoadout(loadout), 0),
        })
        window.testHandle = handle
      }, mode)
      await page.waitForFunction(() => window.__mentalDamage?.casts.meteor > 0, null, {
        timeout: 30000,
      })
      for (const level of [1, 2, 3]) {
        const before = await page.evaluate(() => window.__mentalDamage.casts.meteor)
        await page.evaluate((level) => window.__mentalMagic({ meteor: level }), level)
        await page.waitForFunction((before) => window.__mentalDamage.casts.meteor > before, before)
        await page.waitForTimeout(150)
        await page.screenshot({ path: `/tmp/meteor-shots/${width}-${mode}-${level}-warning.png` })
        await page.waitForTimeout(220)
        await page.screenshot({ path: `/tmp/meteor-shots/${width}-${mode}-${level}-fall.png` })
        await page.waitForTimeout(280)
        await page.screenshot({ path: `/tmp/meteor-shots/${width}-${mode}-${level}-impact.png` })
      }
      const stats = await page.evaluate(() => window.__mentalDamage)
      assert(stats.shown.meteor > 0, '메테오 피해 숫자')
      assert.deepEqual(errors, [])
      console.log(width, mode, stats.casts.meteor, stats.shown.meteor)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
