// 매수 티켓 패턴 (decisions.md 712번): 출전 탭에서 고르면 저장되고, 전장의 매수 주문이 그 패턴으로 뜬다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const width = 390
  const company = structuredClone(fixture)
  const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.locator('[data-testid=idle-canvas] canvas').waitFor()
  await page.locator('[data-tutorial-menu=cats]').click()
  const options = page.getByTestId('buy-pattern-option')
  await expect(options).toHaveCount(5)
  const option = (code) => page.locator(`[data-testid=buy-pattern-option][data-code=${code}]`)
  // 처음에는 전부터 쓰던 양옆이다.
  await expect(option('sides')).toHaveAttribute('aria-pressed', 'true')
  const box = await page.getByTestId('buy-pattern').boundingBox()
  assert(box && box.x >= 0 && box.x + box.width <= width, 'the picker fits the screen')
  await option('center').scrollIntoViewIfNeeded()
  await option('center').click()
  await expect(option('center')).toHaveAttribute('aria-pressed', 'true')
  await expect(option('sides')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('buy-pattern')).toContainText('가운데로 모아서')
  assert.equal(await page.evaluate(() => localStorage.getItem('buy-pattern')), 'center')
  await page.screenshot({ path: '/tmp/buy-pattern.png' })
  // 전장: 가운데 패턴이면 매수 주문이 모두 레인의 가운데 쪽에서 날아간다.
  await page.getByRole('button', { name: '닫기 ✕' }).click()
  const orders = () =>
    page.evaluate(
      () => window.__mentalMarket?.().buyWall?.feedback?.orders?.map((o) => o.x) ?? null,
    )
  const seen = []
  await expect
    .poll(
      async () => {
        for (const x of (await orders()) ?? []) seen.push(x)
        return seen.length
      },
      { timeout: 40000 },
    )
    .toBeGreaterThan(8)
  assert(
    seen.every((x) => x > width * 0.3 && x < width * 0.7),
    `center orders stay in the middle: ${seen.map((x) => Math.round(x)).join(' ')}`,
  )
  // 다시 열어도 고른 패턴이 남아 있다.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=idle-canvas] canvas').waitFor()
  await page.locator('[data-tutorial-menu=cats]').click()
  await expect(option('center')).toHaveAttribute('aria-pressed', 'true')
  assert.deepEqual(errors, [])
  console.log('buy pattern ok')
} finally {
  await browser.close()
}
