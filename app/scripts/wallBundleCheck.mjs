// 매도벽 범위 공격: 앞줄을 겨냥해도 범위 안의 뒤쪽 층에 스플래시 피해가 들어간다.
// 개발 서버(APP_URL, 기본 http://127.0.0.1:5299/app/)를 띄운 뒤 `node scripts/wallBundleCheck.mjs`.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5299/app/')
  await page.locator('[data-testid=idle-canvas] canvas').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.evaluate(async () => {
    const base = '/app/src/mental/'
    const [{ startBattle }, cards, { assaultSpec }, { DEFAULT_WEAPON }] = await Promise.all([
      import(/* @vite-ignore */ `${base}battle.ts`),
      import(/* @vite-ignore */ `${base}cards.ts`),
      import(/* @vite-ignore */ `${base}assault.ts`),
      import(/* @vite-ignore */ `${base}hero.ts`),
    ])
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    // 총은 거의 쏘지 않고, 범위가 가장 넓은 메테오(Lv.5)·물(Lv.5)만 벽에 터지게 한다. 첫 벽은 세 층으로 아주 단단하게.
    const loadout = { ...cards.loadoutOf(DEFAULT_WEAPON), damage: 0.5, fireMs: 100000 }
    const spec = assaultSpec(1)
    spec.walls = spec.walls.map((wall, i) => (i === 0 ? { ...wall, rows: 3, cellHp: 400 } : wall))
    const handle = startBattle(host, {
      mode: 'assault',
      assault: spec,
      genre: 'DEFENSE',
      hero: { name: '사장냥', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      onHud: () => {},
      onBanner: () => {},
      onHurt: () => {},
      onLevelUp: () => setTimeout(() => handle.applyLoadout(loadout), 0),
      onDone: () => {},
    })
    window.magicOn = () => window.__mentalMagic({ meteor: 5, water: 5 })
  })
  await page.waitForFunction(() => window.__mentalWalls?.()[0]?.arrived)
  assert.equal((await page.evaluate(() => window.__mentalWalls()))[0].layers.length, 3)
  await page.evaluate(() => window.magicOn())
  await page.waitForFunction(
    () => {
      const [front] = window.__mentalWalls()[0].layers
      return (
        front.hp < front.maxHp &&
        window
          .__mentalWalls()[0]
          .layers.slice(1)
          .some((layer) => layer.hp < layer.maxHp)
      )
    },
    null,
    { timeout: 30000 },
  )
  const [wall] = await page.evaluate(() => window.__mentalWalls())
  assert.equal(wall.layers.length, 3)
  const [front, ...behind] = wall.layers
  assert(front.hp < front.maxHp, '맨 아래 층은 깎인다')
  assert(
    behind.some((layer) => layer.hp < layer.maxHp),
    '범위 안의 뒤쪽 층도 맞는다',
  )
  assert.deepEqual(errors, [])
  console.log('wall bundle ok', JSON.stringify(wall.layers))
} finally {
  await browser.close()
}
