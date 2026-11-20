import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const cats = [
  ['sky', '하늘냥'],
  ['mint', '민트냥'],
  ['lilac', '라일락냥'],
  ['sunset', '노을냥'],
].map(([code, name], i) => ({
  code,
  name,
  level: i < 2 ? 1 : 0,
  damagePercent: 50,
  firePercent: 100,
  criticalPercent: 100,
  fielded: i < 2,
  skills: [],
  skillLevel: 1,
  skillNextLevel: 10,
  grade: 'C',
  weapon: null,
}))
const company = {
  ...structuredClone(fixture),
  idle: {
    wall: 13,
    hp: 1200,
    maxHp: 1200,
    dps: 12,
    earned: 0,
    boss: false,
    circuitSeconds: 0,
    sequence: 0,
    upcoming: [],
    skills: [],
    fieldSlots: 4,
    rebirth: { count: 0, fish: 0, gain: 0, fromWall: 51, adGain: 0 },
    wallDps: 0,
    power: 1038,
    income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
    offline: null,
    cats,
  },
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const kind of ['cat', 'weapon']) {
    const wallet = structuredClone(company)
    const armory = { mergeCount: 3, lastDraw: null, lastDraws: [] }
    Object.assign(wallet, { armory })
    const page = await browser.newPage({
      viewport: { width: 320, height: 844 },
      reducedMotion: 'reduce',
    })
    let purchases = 0
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/idle')) wallet.idle.sequence = route.request().postDataJSON().sequence
      if (path.endsWith('/draw')) {
        assert.equal(path, `/api/company/${kind}/draw`)
        assert.deepEqual(route.request().postDataJSON(), { count: 10, ad: false })
        purchases++
        wallet.diamonds.amount -= wallet.diamonds.tenDraw
        const draws = Array.from({ length: wallet.diamonds.tenCount }, (_, i) =>
          kind === 'cat'
            ? { code: 'sky', level: i + 1, grade: 'C', isNew: i === 0 }
            : { kind: 'rifle', grade: 'C', gradeName: 'C', name: '소총', isNew: i === 0 },
        )
        Object.assign(kind === 'cat' ? wallet.idle : armory, { lastDraws: draws })
      }
      await route.fulfill({ json: wallet })
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
    await page.getByTestId(`draw-kind-${kind}`).click()
    const buy = page.getByTestId(`${kind}-draw-ten`)
    await buy.evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('뽑기 버튼이 필요합니다')
      button.click()
      button.click()
    })
    await expect(page.getByTestId(`${kind}-ten-count`)).toHaveText('1 / 11')
    await page.getByTestId(`${kind}-ten-single`).click()
    await expect(page.getByTestId(`${kind}-ten-count`)).toHaveText('2 / 11')
    await page.getByTestId(`${kind}-ten-all`).click()
    await expect(page.getByTestId(`${kind}-ten-card`)).toHaveCount(11)
    await expect(page.getByTestId(`${kind}-ten-again`)).toHaveCount(0)
    await page.getByTestId(`${kind}-ten-close`).click()
    await expect(buy).toBeDisabled()
    assert.equal(purchases, 1)
    await page.close()
  }
  console.log('고양이·무기 10연차 결과, 중복 클릭, 잔액 부족 확인')
} finally {
  await browser.close()
}
