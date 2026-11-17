// 절전 모드 (decisions.md 607번): 켜면 검은 화면이 덮고 전장을 그리지 않으며 낮은 빈도로 돌지만 전투는 이어진다. 두 번 누르면 풀린다.
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
      wall: 7,
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let hits = 0
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/idle')) {
      const body = route.request().postDataJSON()
      company.idle.sequence = body.sequence
      for (const hit of body.hits ?? []) hits += hit.count
    }
    await route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.waitForTimeout(2000)
  const market = () => page.evaluate(() => window.__mentalMarket())
  assert.equal((await market()).drawing, true)
  assert.equal((await market()).fpsLimit, 0)
  await expect(page.getByTestId('power-save')).toHaveCount(0)

  // 설정에서 켠다.
  await page.getByTestId('idle-options').click()
  await page.getByTestId('power-save-on').click()
  const screen = page.getByTestId('power-save')
  await expect(screen).toBeVisible()
  await expect(page.getByTestId('power-save-wall')).toHaveText('매도벽 7')
  assert.equal(
    await screen.evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(0, 0, 0)',
    'the screen is black',
  )
  await expect.poll(async () => (await market()).drawing).toBe(false)
  assert.equal((await market()).fpsLimit, 20)

  // 전투는 이어진다: 전투 시계가 실제 시간만큼 가고(느려지지 않는다) 명중이 계속 간다.
  const before = { seconds: (await market()).battleSeconds, hits }
  await page.waitForTimeout(4000)
  const after = { seconds: (await market()).battleSeconds, hits }
  const ran = after.seconds - before.seconds
  assert.ok(ran > 2 && ran < 9, `the battle keeps its pace while saving: ${ran}`)
  assert.ok(after.hits > before.hits, `hits keep landing while saving: ${after.hits - before.hits}`)
  await page.screenshot({ path: '/tmp/power-save.png' })

  // 한 번 누르면 안내만 바뀌고, 두 번 누르면 풀린다.
  await screen.click()
  await expect(page.getByTestId('power-save-hint')).toHaveText('한 번 더 누르면 풀려요')
  await expect(screen).toBeVisible()
  await page.waitForTimeout(1800)
  await expect(page.getByTestId('power-save-hint')).toHaveText('화면을 두 번 누르면 풀려요')
  await screen.click()
  await screen.click()
  await expect(screen).toHaveCount(0)
  await expect.poll(async () => (await market()).drawing).toBe(true)
  assert.equal((await market()).fpsLimit, 0)
  const resumed = (await market()).battleSeconds
  await page.waitForTimeout(1500)
  assert.ok((await market()).battleSeconds > resumed, 'the battle runs after waking')
  assert.deepEqual(errors, [])
  console.log(
    `power save ok: ${ran.toFixed(1)} battle seconds and ${after.hits - before.hits} hits in 4s while saving`,
  )
} finally {
  await browser.close()
}
