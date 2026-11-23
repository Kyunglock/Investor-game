// 매도벽 돌파 스테이지의 레벨업 카드 (decisions.md 667번): 메인 화면의 스테이지 단추로 들어가, 사장냥의 스킬 카드를 고르면 그 스킬이
// 1분 동안 켜지는지 본다. 개발 서버에서만 돈다(window.__mentalCards, __mentalMarket).
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
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    const reports = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      if (route.request().url().endsWith('/company/assault')) {
        reports.push(route.request().postDataJSON())
      }
      return route.fulfill({ json: company })
    })
    await page.addInitScript(() => {
      window.__mentalCards = ['rally', 'stopLoss', 'cat-up']
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    // 메인 화면: 사장냥의 스킬 단추와 레벨 단추는 없고 스테이지 입구가 있다.
    await expect(page.getByTestId('idle-active')).toHaveCount(0)
    await expect(page.getByTestId('idle-level')).toHaveCount(0)
    await page.getByTestId('stage-shortcut').click()
    await page.locator('[data-testid=assault-stage][data-stage="1"]').click()
    // 스테이지: 첫 카드 석 장에 사장냥의 스킬과 고양이 마법 강화가 나온다.
    // 출전 화면: 무기를 보고 들어간다.
    await page.getByRole('button', { name: /돌파하러 가기/ }).click()
    const pick = page.getByTestId('mental-levelup')
    await expect(pick).toBeVisible({ timeout: 60000 })
    await expect(pick.locator('[data-card]')).toHaveCount(3)
    await expect(pick.locator('[data-card=rally]')).toContainText('불장')
    await expect(pick.locator('[data-card=rally]')).toContainText('1분 동안')
    await expect(pick.locator('[data-card=rally]')).toContainText('사장냥 스킬')
    await expect(pick.locator('[data-card=stopLoss]')).toContainText('바로 발동')
    await expect(pick.locator('[data-card=cat-up]')).toContainText('고양이 마법 강화')
    await page.screenshot({ path: `/tmp/stage-cards-${width}.png` })
    await pick.locator('[data-card=rally]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    // 고른 불장이 1분 동안 켜진다(전투 초).
    await expect
      .poll(() => page.evaluate(() => window.__mentalMarket?.().actives.rally ?? 0), {
        timeout: 15000,
      })
      .toBeGreaterThan(50)
    const rally = await page.evaluate(() => window.__mentalMarket().actives.rally)
    assert.ok(rally <= 60, `rally lasts a minute: ${rally}`)
    await page.screenshot({ path: `/tmp/stage-rally-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('스테이지 레벨업 카드 320/390px: 입구·스킬 카드·1분 지속 통과')
} finally {
  await browser.close()
}
