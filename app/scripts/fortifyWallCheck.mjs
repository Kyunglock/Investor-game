// 실제 전투에서 매수벽 강화의 표시 시간·재발동·상태를 확인한다.
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
  await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible()
  await page.waitForTimeout(1500)
  const inspect = () => page.evaluate(() => window.__mentalMarket?.().buyWall.feedback)
  const cast = () =>
    page.evaluate(() => window.dispatchEvent(new CustomEvent('idle-active', { detail: 'fortify' })))
  assert.equal((await inspect()).fortified, false)
  await cast()
  await expect.poll(async () => (await inspect()).fortified).toBe(true)
  await page.screenshot({ path: '/tmp/fortify-wall-390.png' })
  for (const speed of [1, 2]) {
    await page.evaluate((speed) => window.__mentalSpeed(speed), speed)
    await cast()
    await expect.poll(async () => (await inspect()).fortified).toBe(true)
    const start = Date.now()
    assert.match((await inspect()).label, /^강화 매수벽 /)
    await page.waitForTimeout(4000)
    assert.equal((await inspect()).fortified, true)
    await expect
      .poll(async () => (await inspect()).fortified, { timeout: 2500, intervals: [50] })
      .toBe(false)
    assert.ok(Date.now() - start >= 4700)
    assert.ok(Date.now() - start < 6500)
    assert.match((await inspect()).label, /^매수벽 /)
  }
  await cast()
  await page.waitForTimeout(3000)
  await cast()
  await page.setViewportSize({ width: 320, height: 740 })
  await page.waitForTimeout(3000)
  assert.equal((await inspect()).fortified, true)
  await page.screenshot({ path: '/tmp/fortify-wall-320.png' })
  await expect
    .poll(async () => (await inspect()).fortified, { timeout: 3000, intervals: [50] })
    .toBe(false)
  await cast()
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
  )
  const left = (await inspect()).fortifySecondsLeft
  await page.waitForTimeout(1200)
  assert.equal((await inspect()).fortifySecondsLeft, left)
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('idle-app-active', { detail: true })),
  )
  await page.reload()
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  assert.equal((await inspect()).fortified, false)
  assert.deepEqual(errors, [])
  console.log('fortified wall ok: five seconds at 1x/2x, label, recast, resize, pause, reload')
} finally {
  await browser.close()
}
