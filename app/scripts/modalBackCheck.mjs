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
    let release
    let hold = false
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/app/ads.ts*', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export const AD_UNAVAILABLE = '광고를 불러오지 못했어요.'; export const preloadRewardedAd = () => {}; export async function watchRewardedAd() { await new Promise(r => setTimeout(r, 250)); return window.adResult || 'rewarded'; }`,
      }),
    )
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const url = route.request().url()
      if (url.endsWith('/cat/draw') || url.endsWith('/weapon/draw')) {
        if (hold)
          await new Promise((resolve) => {
            release = resolve
          })
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

    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    const back = () =>
      page.evaluate(async () => (await import('/app/src/app/ui.ts')).useAppUi.getState().back())
    for (const close of ['native', 'escape', 'button']) {
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent('idle-cat-info', { detail: 'sky' })),
      )
      await expect(page.getByTestId('cat-info')).toBeVisible()
      await expect(page.getByTestId('cat-info-close')).toBeEnabled()
      if (close === 'native') assert.equal(await back(), true)
      if (close === 'escape') await page.keyboard.press('Escape')
      if (close === 'button') await page.getByTestId('cat-info-close').click()
      await expect(page.getByTestId('cat-info')).toHaveCount(0)
      assert.equal(await back(), false)
    }
    await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
    for (const kind of ['cat', 'weapon']) {
      await page.getByTestId(`draw-kind-${kind}`).click()
      for (const close of ['native', 'escape', 'button']) {
        hold = true
        release = undefined
        await page.getByTestId(`${kind}-draw`).click()
        await expect.poll(() => Boolean(release)).toBe(true)
        assert.equal(await back(), true)
        await expect(page.getByTestId(`${kind}-reveal`)).toBeVisible()
        release()
        hold = false
        await expect(page.getByTestId(`${kind}-reveal-close`)).toBeVisible()
        if (close === 'native') assert.equal(await back(), true)
        if (close === 'escape') await page.keyboard.press('Escape')
        if (close === 'button') await page.getByTestId(`${kind}-reveal-close`).click()
        await expect(page.getByTestId(`${kind}-reveal`)).toHaveCount(0)
        await expect(page.getByTestId('cat-gacha')).toHaveAttribute('data-kind', kind)
      }
    }
    assert.equal(await back(), true)
    await expect(page.getByTestId('cat-gacha')).toHaveCount(0)
    assert.equal(await back(), false)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('팝업 뒤로 가기: 정보·고양이/무기 결과·대기·Escape·닫기·핸들러 복원 통과')
} finally {
  await browser.close()
}
