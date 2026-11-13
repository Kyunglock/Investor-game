/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

// 전투 규칙은 기존 테스트가 맡는다. 여기서는 결과를 주입해 첫 진입·별 연출·저장 대기를 검증한다.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  channel: process.env.BROWSER_CHANNEL || undefined,
})
try {
  for (const width of [320, 390]) {
    const company = {
      ...structuredClone(fixture),
      year: 1,
      quarter: 1,
      lastQuarter: null,
      lastSettlement: null,
      assaults: { best: 0, last: 100, perChapter: 10, lastResult: null as object | null },
    }
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'on'))
    const mutations: string[] = []
    let reports = 0
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() === 'POST') mutations.push(path)
      if (path.endsWith('/assault')) {
        reports++
        assert.deepEqual(route.request().postDataJSON(), { stage: 1, cleared: true, stars: 3 })
        // 한 화면은 저장 실패→재시도, 다른 화면은 연출보다 느린 저장을 확인한다.
        if (width === 320 && reports === 1) {
          await route.fulfill({ status: 500, json: { message: '저장 재시도' } })
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 4200))
        company.assaults.best = 1
        company.assaults.lastResult = { firstClear: true, capital: 10000, tickets: 1 }
      }
      await route.fulfill({ json: company })
    })
    await page.route('**/src/mental/battle.ts', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export function startBattle(host, opts) {
        host.dataset.started = 'true';
        window.finishFirstBattle = () => opts.onDone({win:true, stars:3, reason:'clear', kills:10, mentalLeft:100, maxMental:100, segments:10, seconds:40, wallsBroken:10, wallsTotal:10, priceStart:100, priceEnd:200});
        opts.onReady?.();
        return {stop(){},setPaused(){},setSpeed(){},applyLoadout(){}};
      }`,
      }),
    )
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5299/app/')
    await expect(page.getByTestId('battle-canvas')).toHaveAttribute('data-started', 'true')
    await expect(page.getByTestId('tutorial-guide')).toHaveCount(0)
    await expect(page.getByTestId('mental-lobby')).toHaveCount(0)
    assert.equal(mutations.length, 0, '채용·회의 API 없이 첫 전투 진입')
    await page.evaluate(() =>
      (window as unknown as { finishFirstBattle: () => void }).finishFirstBattle(),
    )
    await expect(page.getByTestId('first-clear')).toHaveAttribute('data-filled', '1')
    await expect(page.getByTestId('first-clear')).toHaveAttribute('data-filled', '2')
    await expect(page.getByTestId('first-clear')).toHaveAttribute('data-filled', '3')
    await page.screenshot({ path: `/tmp/first-clear-${width}.png` })
    if (width === 320) {
      await page.getByTestId('mental-done').click()
      await expect(page.getByTestId('first-clear')).toBeVisible()
    }
    await expect(page.getByTestId('first-clear')).toHaveCount(0, { timeout: 10000 })
    await expect(page.getByTestId('company-building')).toBeVisible()
    await expect(page.getByTestId('assault-chapter')).toHaveCount(0)
    assert.equal(
      await page.evaluate(
        (id) => localStorage.getItem(`investor-game.first-play.v1:${id}`),
        company.companyId,
      ),
      'done',
    )
    // 완료 후 같은 회사를 새로고침해도 첫 스테이지를 다시 시작하지 않는다.
    await page.reload()
    await expect(page.getByTestId('company-building')).toBeVisible()
    await expect(page.getByTestId('battle-canvas')).toHaveCount(0)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`first stage → stars → office OK (${width}px)`)
  }
} finally {
  await browser.close()
}
