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
      if (url.endsWith('/idle/active')) {
        const body = route.request().postDataJSON()
        calls.push(body)
        company.idle.actives.find((active) => active.code === body.code).left = 180
      }
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

    company.idle.actives = [
      ['boostFire', '공격속도 3배'],
      ['boostDamage', '공격력 3배'],
      ['boostBuy', '매수공격 3배'],
    ].map(([code, name]) => ({
      code,
      name,
      ad: true,
      cooldown: 180,
      seconds: 180,
      readyIn: 0,
      left: 0,
    }))
    await page.goto(process.env.APP_URL ?? 'http://localhost:5186/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    const back = () =>
      page.evaluate(async () => (await import('/app/src/app/ui.ts')).useAppUi.getState().back())
    for (const code of ['boostFire', 'boostDamage', 'boostBuy']) {
      await page.locator(`[data-testid=idle-ad-active][data-code=${code}]`).click()
      await expect(page.getByTestId('ad-skill-details')).toContainText('3분 동안')
      await expect(page.getByTestId('ad-skill-details')).toContainText('하나만 동시에')
      assert.equal(calls.length, 0)
      assert.equal(await back(), true)
      await expect(page.getByTestId('ad-skill-details')).toHaveCount(0)
    }
    await page.locator('[data-testid=idle-ad-active][data-code=boostDamage]').click()
    for (const outcome of ['closed', 'unavailable']) {
      await page.evaluate((value) => {
        window.adResult = value
      }, outcome)
      await page.getByTestId('ad-skill-confirm').click()
      await expect(page.getByTestId('ad-skill-details').getByRole('alert')).toBeVisible()
      assert.equal(calls.length, 0)
    }
    await page.evaluate(() => {
      window.adResult = 'rewarded'
    })
    await page.getByTestId('ad-skill-confirm').evaluate((button) => {
      button.click()
      button.click()
    })
    await expect(page.getByTestId('ad-skill-details')).toHaveCount(0)
    assert.deepEqual(calls, [{ code: 'boostDamage', ad: true }])
    await page.locator('[data-testid=idle-ad-active][data-code=boostFire]').click()
    await expect(page.getByTestId('ad-skill-confirm')).toBeDisabled()
    await expect(page.getByTestId('ad-skill-details')).toContainText('공격력 3배 사용 중')
    await page.screenshot({ path: `/tmp/skill-help-${width}.png` })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ad-skill-details')).toHaveCount(0)
    assert.equal(await back(), false)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('광고 스킬 설명·실행 분리·취소·실패·중복 방지·효과 중 안내·뒤로 가기 통과')
} finally {
  await browser.close()
}
