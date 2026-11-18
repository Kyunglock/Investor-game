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
    company.diamonds.amount = 0
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
      viewport: { width, height: 844 },
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
    const open = async () => {
      await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
      await page.locator('[data-testid=idle-canvas] canvas').waitFor()
      await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
    }
    await open()
    for (const result of ['closed', 'unavailable']) {
      await page.evaluate((value) => {
        window.adResult = value
      }, result)
      await page.getByTestId('cat-draw-ad').click()
      await expect(page.getByRole('alert')).toContainText(
        result === 'closed' ? '끝까지' : '불러오지',
      )
      await expect(page.getByTestId('cat-draw-ad')).toContainText('3 / 3')
      assert.equal(calls.length, 0)
    }
    await page.evaluate(() => {
      window.adResult = 'rewarded'
    })
    for (const kind of ['cat', 'weapon']) {
      await page.getByTestId(`draw-kind-${kind}`).click()
      await expect(page.getByTestId(`${kind}-draw-ten`)).toHaveCount(0)
      await expect(page.getByTestId(`${kind}-draw`)).toBeDisabled()
      for (let left = 2; left >= 0; left--) {
        await page.getByTestId(`${kind}-draw-ad`).evaluate((button) => {
          button.click()
          button.click()
        })
        await page.getByTestId(`${kind}-reveal-close`).click()
        await expect(page.getByTestId(`${kind}-draw-ad`)).toContainText(`${left} / 3`)
      }
      await expect(page.getByTestId(`${kind}-draw-ad`)).toBeDisabled()
    }
    assert.equal(calls.length, 6)
    assert.equal(company.diamonds.amount, 0)
    await open()
    await expect(page.getByTestId('cat-draw-ad')).toBeDisabled()
    company.diamonds.amount = company.diamonds.draw
    await open()
    await page.getByTestId('cat-draw').click()
    await page.getByTestId('cat-reveal-close').click()
    assert.equal(calls.at(-1).ad, false)
    assert.equal(company.diamonds.amount, 0)
    assert.equal(company.adDraws.catLeft, 0)
    company.adDraws.catLeft = company.adDraws.weaponLeft = 3
    await open()
    await expect(page.getByTestId('cat-draw-ad')).toBeEnabled()
    await page.screenshot({ path: `/tmp/ad-draw-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('광고 뽑기: 취소·실패·중복 클릭·종류별 3회·새로고침·유료 뽑기·일일 초기화 통과')
} finally {
  await browser.close()
}
