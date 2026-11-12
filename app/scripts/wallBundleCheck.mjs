// 매도벽은 한 묶음이다 (#681): 범위 마법(메테오·물)이 터져도 맨 아래 층만 깎이고 그 위층은 그대로다. 넘친 피해는 다음 층으로 이어진다.
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
  await page.evaluate(() => window.magicOn())
  await page.waitForFunction(
    () => {
      const [front] = window.__mentalWalls()[0].layers
      return front.maxHp - front.hp > front.maxHp * 0.01
    },
    null,
    { timeout: 30000 },
  )
  const [wall] = await page.evaluate(() => window.__mentalWalls())
  assert.equal(wall.layers.length, 3)
  const [front, ...behind] = wall.layers
  assert(front.hp < front.maxHp, '맨 아래 층은 깎인다')
  for (const layer of behind) assert.equal(layer.hp, layer.maxHp, '위층은 범위 마법에 맞지 않는다')
  assert.deepEqual(errors, [])
  console.log('wall bundle ok', JSON.stringify(wall.layers))
} finally {
  await browser.close()
}
