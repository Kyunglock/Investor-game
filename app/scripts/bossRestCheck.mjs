// 사장냥도 쉴 수 있다 (decisions.md 672번): 출전 탭에서 사장냥을 쉬게 하면 전장에서 사라지고 총을 쏘지 않는다. 고양이가 없으면 쉴 수 없고,
// 쉬는 동안 마지막 고양이는 뺄 수 없다. 개발 서버에서만 돈다(window.__mentalMarket).
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const company = structuredClone(fixture)
    const cat = (code, name, fielded, slot) => ({
      code,
      name,
      level: 1,
      damagePercent: 50,
      firePercent: 100,
      criticalPercent: 100,
      fielded,
      slot,
      skills: [],
      skillLevel: 1,
      skillNextLevel: 10,
      grade: 'C',
      weapon: null,
    })
    company.idle = {
      wall: 1,
      hp: 1e9,
      maxHp: 1e9,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      upcoming: [],
      skills: [],
      fieldSlots: 4,
      bossFielded: true,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
      lastDraws: [],
      actives: [],
      cats: [cat('sky', '하늘냥', false, null)],
    }
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    const calls = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      const path = new URL(route.request().url()).pathname
      const body = route.request().postDataJSON()
      if (path.endsWith('/boss/field')) {
        calls.push(body)
        company.idle.bossFielded = body.fielded
      }
      if (path.endsWith('/cat/field')) {
        const me = company.idle.cats.find((c) => c.code === body.code)
        Object.assign(me, { fielded: body.fielded, slot: body.fielded ? 0 : null })
      }
      return route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    const stand = () => page.evaluate(() => window.__mentalMarket?.().stand)
    await expect.poll(async () => (await stand())?.heroVisible, { timeout: 30000 }).toBe(true)

    await page.locator('[data-tutorial-menu=cats]').click()
    await page.getByTestId('cat-boss').click()
    const bossField = page.getByTestId('boss-field')
    // 고양이가 없으면 사장냥은 쉴 수 없다.
    await expect(bossField).toHaveText('출전 중')
    await expect(bossField).toBeDisabled()

    // 하늘냥을 출전시키면 사장냥이 쉴 수 있다.
    await page.locator('[data-testid=cat-card][data-code=sky], [data-code=sky]').first().click()
    await page.getByTestId('cat-field').click()
    await expect(page.getByTestId('cat-field')).toHaveText('출전 중')
    await page.getByTestId('cat-boss').click()
    await expect(bossField).toBeEnabled()
    await bossField.click()
    assert.deepEqual(calls, [{ fielded: false }])
    await expect(bossField).toHaveText('출전')
    await expect(page.getByTestId('cat-boss')).toHaveAttribute('aria-label', /쉬는 중/)
    await expect(page.getByTestId('cat-boss')).toHaveAttribute('data-fielded', 'false')

    // 전장: 사장냥은 사라지고 이름표도 없다. 하늘냥만 서서 쏜다.
    await expect.poll(async () => (await stand()).heroVisible, { timeout: 15000 }).toBe(false)
    const rested = await stand()
    assert.equal(rested.tags[0], null)
    assert.equal(rested.xs.length, 2)
    const shots = rested.heroShots
    const mateShots = await page.evaluate(() => window.__mentalDamage.mateShots)
    await expect
      .poll(() => page.evaluate(() => window.__mentalDamage.mateShots), { timeout: 20000 })
      .toBeGreaterThan(mateShots + 3)
    assert.equal((await stand()).heroShots, shots, '쉬는 사장냥은 쏘지 않는다')
    await page.screenshot({ path: `/tmp/boss-rest-${width}.png` })

    // 쉬는 동안 마지막 고양이는 뺄 수 없다.
    await page.locator('[data-testid=cat-slot][data-code=sky]').click()
    await expect(page.getByTestId('cat-field')).toBeDisabled()

    // 다시 내보내면 돌아와 쏜다.
    await page.getByTestId('cat-boss').click()
    await bossField.click()
    assert.deepEqual(calls.at(-1), { fielded: true })
    await expect.poll(async () => (await stand()).heroVisible, { timeout: 15000 }).toBe(true)
    await expect
      .poll(async () => (await stand()).heroShots, { timeout: 20000 })
      .toBeGreaterThan(shots)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log(
    '사장냥 쉬기 320/390px: 출전 탭의 단추·전장에서 사라짐·쏘지 않음·마지막 고양이 보호 통과',
  )
} finally {
  await browser.close()
}
