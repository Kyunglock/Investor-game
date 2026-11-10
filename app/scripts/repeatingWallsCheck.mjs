import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined })
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference',
  })
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
    const spec = assaultSpec(1)
    // 전환 도중 이미 날아간 강화탄이 다음 벽을 즉사시키지 않게 관찰할 벽만 단단하게 둔다.
    spec.walls = spec.walls.map((wall, index) => (index === 0 ? wall : { ...wall, cellHp: 100000 }))
    const handle = startBattle(host, {
      mode: 'assault',
      assault: spec,
      genre: 'DEFENSE',
      hero: { name: '사장냥', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      onHud: (hud) => {
        window.hud = hud
      },
      onBanner: (text) => {
        if (text.startsWith('매도벽 돌파!')) {
          window.collapse = {
            market: window.__mentalMarket(),
            walls: window.__mentalWalls(),
          }
        }
        if (text === '매도벽을 부수고 다음 벽으로!') {
          window.wallTransitions.push(window.__mentalWalls())
          if (window.__mentalWalls().some((wall) => wall.index > 0)) {
            window.transitionMarket = window.__mentalMarket()
            loadout = { ...loadout, damage: 0.01, fireMs: 10000, lightning: 0 }
            handle.applyLoadout(loadout)
          }
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
  const hit = await page.evaluate(() => {
    const before = window.__mentalMarket()
    window.__mentalBuyWallHit(1)
    return { before, after: window.__mentalMarket() }
  })
  assert.equal(hit.after.buyWall.hp, hit.before.buyWall.hp - 1)
  assert.equal(hit.after.mental, hit.before.mental)
  assert(hit.after.buyWall.feedback.hitLeft > 0)
  if (process.env.WALL_HIT_SHOT) await page.screenshot({ path: process.env.WALL_HIT_SHOT })
  const broken = await page.evaluate(() => {
    window.mentalBeforeBreak = window.__mentalMarket().mental
    window.__mentalBuyWallHit(100000)
    return window.__mentalMarket()
  })
  const mentalBeforeBreak = await page.evaluate(() => window.mentalBeforeBreak)
  assert.equal(broken.mental, mentalBeforeBreak - Math.max(1, Math.round(broken.maxMental * 0.12)))
  assert(broken.buyWall.feedback.breakLeft > 0)
  assert.equal(broken.buyWall.feedback.fragments, 12)
  if (process.env.WALL_BREAK_SHOT) {
    await page.waitForTimeout(180)
    await page.screenshot({ path: process.env.WALL_BREAK_SHOT })
  }
  const protectedHit = await page.evaluate(() => {
    window.__mentalBuyWallHit(100000)
    return window.__mentalMarket()
  })
  assert.equal(protectedHit.mental, broken.mental)
  assert.equal(protectedHit.buyWall.breaks, broken.buyWall.breaks)
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
  const entering = transitions.find((wall) => wall.index === 1)
  assert(entering && !entering.arrived)
  const collapse = await page.evaluate(() => window.collapse)
  const transition = await page.evaluate(() => window.transitionMarket)
  assert.equal(collapse.walls.length, 0, 'old wall breaks before the next wall appears')
  assert(
    transition.battleSeconds - collapse.market.battleSeconds >= 1.48,
    'show collapse for 1.5 seconds',
  )
  assert(
    transition.battleSeconds - collapse.market.battleSeconds < 1.8,
    'start the next wall promptly after 1.5 seconds',
  )
  await page.waitForFunction(() =>
    window.__mentalWalls().some((wall) => wall.index === 1 && wall.arrived),
  )
  const arrival = await page.evaluate(() => ({
    wall: window.__mentalWalls().find((wall) => wall.index === 1),
    market: window.__mentalMarket(),
    start: window.transitionMarket,
  }))
  assert(arrival.wall.bottom > entering.bottom + 100)
  assert(arrival.market.climbed > arrival.start.climbed + 100)
  assert.equal(arrival.market.buyWall.playerX, before.playerX)
  assert.equal(arrival.market.buyWall.playerY, before.playerY)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: buy-wall hit/break feedback, mental loss once, immediate rebuild/push, forward scrolling',
  )
} finally {
  await browser.close()
}
