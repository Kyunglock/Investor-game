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

    for (const amount of [0, 1200]) {
      for (const left of [0, 3]) {
        company.diamonds.amount = amount
        company.adDraws.catLeft = company.adDraws.weaponLeft = left
        await page.goto(process.env.APP_URL ?? 'http://localhost:5187/app/')
        await page.locator('[data-testid=idle-canvas] canvas').waitFor()
        await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
        for (const kind of ['cat', 'weapon']) {
          await page.getByTestId(`draw-kind-${kind}`).click()
          await expect(page.getByTestId('draw-note')).toContainText(
            kind === 'cat' ? 'S 1% · A 10% · B 28% · C 61%' : 'F~A 등급',
          )
          await expect(page.getByTestId('draw-note')).not.toContainText('모자라요')
          await expect(page.getByTestId('draw-ad-status')).toContainText(
            left > 0 ? '광고로 무료 뽑기 가능' : '오늘 광고 뽑기 완료',
          )
          await expect(page.getByTestId('draw-paid-short')).toHaveCount(amount === 0 ? 1 : 0)
          assert.equal(await page.getByTestId(`${kind}-draw`).isEnabled(), amount > 0)
          assert.equal(await page.getByTestId(`${kind}-draw-ad`).isEnabled(), left > 0)
        }
      }
    }
    await page.screenshot({ path: `/tmp/draw-info-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('뽑기 안내: 2종 × 잔액 충분/부족 × 광고 가능/소진 × 2화면 통과')
} finally {
  await browser.close()
}
