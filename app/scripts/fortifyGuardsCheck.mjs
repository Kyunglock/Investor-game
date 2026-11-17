// 실제 전투에서 방패 고양이의 표시 시간·재발동·위치를 확인한다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const company = {
    ...structuredClone(fixture),
    idle: {
      wall: 1,
      hp: 1000000,
      maxHp: 1000000,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      upcoming: [],
      skills: [],
      cats: [],
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
    },
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/idle')) {
      company.idle.sequence = route.request().postDataJSON().sequence
    }
    await route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  const inspect = () => page.evaluate(() => window.__mentalMarket?.())
  const cast = () =>
    page.evaluate(() => window.dispatchEvent(new CustomEvent('idle-active', { detail: 'fortify' })))
  assert.equal((await inspect()).fortifyGuards, null)
  await cast()
  await page.screenshot({ path: '/tmp/fortify-guards-390.png' })
  for (const speed of [1, 2]) {
    await page.evaluate((speed) => window.__mentalSpeed(speed), speed)
    await cast()
    await expect.poll(async () => (await inspect()).fortifyGuards.guards.length).toBe(3)
    const start = Date.now()
    const state = await inspect()
    for (const guard of state.fortifyGuards.guards) {
      assert.equal(guard.texture, 'art-shieldGuard')
      assert.ok(guard.feetY < state.buyWall.wallY)
    }
    await page.waitForTimeout(4000)
    assert.equal((await inspect()).fortifyGuards.guards.length, 3)
    await expect
      .poll(async () => (await inspect()).fortifyGuards.guards.length, {
        timeout: 2500,
        intervals: [50],
      })
      .toBe(0)
    assert.ok(Date.now() - start >= 4700)
    assert.ok(Date.now() - start < 6500)
  }
  await cast()
  await page.waitForTimeout(3000)
  await cast()
  await page.setViewportSize({ width: 320, height: 740 })
  await page.waitForTimeout(3000)
  const state = await inspect()
  assert.equal(state.fortifyGuards.guards.length, 3)
  for (const guard of state.fortifyGuards.guards) {
    assert.ok(guard.x - guard.width / 2 > 0)
    assert.ok(guard.x + guard.width / 2 < 320)
    assert.ok(guard.feetY < state.buyWall.wallY)
  }
  await page.screenshot({ path: '/tmp/fortify-guards-320.png' })
  await expect
    .poll(async () => (await inspect()).fortifyGuards.guards.length, {
      timeout: 3000,
      intervals: [50],
    })
    .toBe(0)
  await page.reload()
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  assert.equal((await inspect()).fortifyGuards, null)
  assert.deepEqual(errors, [])
  console.log('fortify guards ok: three cats, five seconds at 1x/2x, recast, resize, reload')
} finally {
  await browser.close()
}
