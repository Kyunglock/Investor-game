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
    company.diamonds.amount = 1200
    company.armory = { mergeCount: 2, lastDraw: null, lastDraws: [] }
    company.weapons = [
      {
        kind: 'pistol',
        name: '권총',
        grade: 'F',
        gradeName: 'F',
        damagePercent: 100,
        fireMs: 260,
        power: 0,
        bulletSpeed: 720,
        equipped: true,
        count: 1,
      },
    ]
    company.idle = {
      wall: 1,
      hp: 1200,
      maxHp: 1200,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      upcoming: [],
      skills: [],
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
      lastDraws: [],
      cats: [
        {
          code: 'sky',
          name: '하늘냥',
          level: 1,
          damagePercent: 50,
          firePercent: 100,
          criticalPercent: 100,
          fielded: true,
          skills: [],
          skillLevel: 1,
          skillNextLevel: 10,
          grade: 'C',
          weapon: null,
        },
      ],
    }
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    const calls = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/app/ads.ts*', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export const AD_UNAVAILABLE = '광고를 불러오지 못했어요.'; export const preloadRewardedAd = () => {}; export async function watchRewardedAd() { await new Promise(r => setTimeout(r, 250)); return window.adResult || 'rewarded'; }`,
      }),
    )
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      const url = route.request().url()
      if (url.endsWith('/cat/draw') || url.endsWith('/weapon/draw')) {
        const body = route.request().postDataJSON()
        assert.equal(body.count, 1)
        const cat = url.endsWith('/cat/draw')
        const key = cat ? 'catLeft' : 'weaponLeft'
        if (body.ad) {
          assert.ok(company.adDraws[key] > 0)
          company.adDraws[key]--
        } else company.diamonds.amount -= company.diamonds.draw
        calls.push({ cat, ...body })
        if (cat) company.idle.cats[0].level++
        else {
          company.weapons[0].count++
          company.armory.lastDraw = { kind: 'pistol', grade: 'F', isNew: false }
          company.armory.lastDraws = [company.armory.lastDraw]
        }
      }
      return route.fulfill({ json: company })
    })

    await page.goto(process.env.APP_URL ?? 'http://localhost:5185/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
    for (const kind of ['cat', 'weapon']) {
      await page.getByTestId(`draw-kind-${kind}`).click()
      const before = calls.length
      await page.getByTestId(`${kind}-draw-ad`).click()
      const result = page.getByTestId(`${kind}-reveal`)
      await expect(page.getByTestId(`${kind}-reveal-ad`)).toContainText('2 / 3')
      await expect(page.getByTestId(`${kind}-reveal-again`)).toContainText('다이아로 뽑기')
      for (const outcome of ['closed', 'unavailable']) {
        await page.evaluate((value) => {
          window.adResult = value
        }, outcome)
        await page.getByTestId(`${kind}-reveal-ad`).click()
        await expect(result.getByRole('alert')).toBeVisible()
        assert.equal(calls.length, before + 1)
        await expect(page.getByTestId(`${kind}-reveal-ad`)).toContainText('2 / 3')
      }
      await page.evaluate(() => {
        window.adResult = 'rewarded'
      })
      for (const left of [1, 0]) {
        await page.getByTestId(`${kind}-reveal-ad`).evaluate((button) => {
          button.click()
          button.click()
        })
        await expect(page.getByTestId(`${kind}-reveal-ad`)).toContainText(`${left} / 3`)
      }
      assert.equal(calls.length, before + 3)
      await expect(page.getByTestId(`${kind}-reveal-ad`)).toBeDisabled()
      assert.equal(company.diamonds.amount, kind === 'cat' ? 1200 : 1100)
      await page.getByTestId(`${kind}-reveal-again`).click()
      await expect.poll(() => calls.length).toBe(before + 4)
      assert.equal(calls.at(-1).ad, false)
      await page.getByTestId(`${kind}-reveal-close`).click()
    }
    company.diamonds.amount = 0
    company.adDraws.catLeft = 3
    await page.reload()
    await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
    await page.getByTestId('cat-draw-ad').click()
    await expect(page.getByTestId('cat-reveal-again')).toBeDisabled()
    await expect(page.getByTestId('cat-reveal-ad')).toBeEnabled()
    await page.getByTestId('cat-reveal-ad').click()
    await expect(page.getByTestId('cat-reveal-ad')).toContainText('1 / 3')
    await page.getByTestId('cat-reveal-ad').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/repeat-draw-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('결과 창 광고 반복·취소·실패·3회 제한·유료 분리·잔액 부족 통과')
} finally {
  await browser.close()
}
