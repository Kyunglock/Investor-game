import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined })
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
    let loadout = { ...cards.loadoutOf(DEFAULT_WEAPON), damage: 0.01, fireMs: 10000 }
    window.wallTransitions = []
    const handle = startBattle(host, {
      mode: 'assault',
      assault: assaultSpec(1),
      genre: 'DEFENSE',
      hero: { name: '사장냥', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      onHud: (hud) => {
        window.hud = hud
      },
      onBanner: (text) => {
        if (text === '매도벽을 부수고 다음 벽으로!') {
          window.wallTransitions.push(window.__mentalWalls())
        }
      },
      onHurt: () => {},
      onLevelUp: () => setTimeout(() => handle.applyLoadout(loadout), 0),
      onDone: (outcome) => {
        window.outcome = outcome
      },
    })
    window.powerUp = () => {
      loadout = { ...loadout, damage: 30, fireMs: 60, lightning: 5 }
      handle.applyLoadout(loadout)
    }
  })
  await page.waitForFunction(() => window.hud?.secondsLeft < 176)
  const before = await page.evaluate(() => window.__mentalMarket().buyWall)
  await page.mouse.move(190, 700)
  await page.mouse.down()
  await page.mouse.move(320, 550, { steps: 8 })
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(350)
  await page.keyboard.up('ArrowRight')
  await page.mouse.up()
  const after = await page.evaluate(() => window.__mentalMarket().buyWall)
  assert.equal(after.playerX, before.playerX)
  assert.equal(after.playerY, before.playerY)
  const broken = await page.evaluate(() => {
    window.__mentalBuyWallHit(100000)
    return window.__mentalMarket()
  })
  assert.equal(broken.buyWall.hp, broken.buyWall.maxHp)
  assert.equal(broken.buyWall.rebuildLeft, 0)
  assert.equal(broken.buyWall.playerY, before.playerY)
  assert(broken.pushedEnemies.length > 0)
  assert(broken.pushedEnemies.every((enemy) => enemy.velocityY === -600))
  await page.evaluate(() => window.powerUp())
  await page.waitForFunction(() =>
    window.wallTransitions.some((walls) => walls.some((wall) => wall.index > 0)),
  )
  const transitions = await page.evaluate(() =>
    window.wallTransitions.flat().filter((wall) => wall.index > 0),
  )
  assert(transitions.every((wall) => wall.bottom > 0 && !wall.held))
  assert.deepEqual(errors, [])
  console.log('PASS: fixed cat, immediate buy wall, monster push, immediate next sell wall')
} finally {
  await browser.close()
}
