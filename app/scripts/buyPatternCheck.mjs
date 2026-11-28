// 매수 티켓 패턴 (decisions.md 712번): 출전의 '매수 티켓' 탭에서 그림을 보고 고르면 저장되고, 전장의 매수 주문이 그 패턴으로 뜬다.
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
  // 고양이·무기 옆의 셋째 탭이다. 고양이 탭에는 패턴이 없다.
  await expect(page.getByTestId('buy-pattern')).toHaveCount(0)
  const tab = page.getByRole('tab', { name: '매수 티켓', exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('cat-detail')).toBeHidden()
  // 출전 칸(고양이·무기 줄)도 이 탭에는 없다: 탭과 패턴만 보인다.
  await expect(page.getByRole('list', { name: '출전 칸' })).toBeHidden()
  await expect(page.getByTestId('cat-boss')).toBeHidden()
  const options = page.getByTestId('buy-pattern-option')
  await expect(options).toHaveCount(9)
  // 패턴마다 날아가는 모양의 그림이 있다: 주문 열다섯 장.
  for (const code of ['line', 'stairs', 'pillars', 'wedge'])
    await expect(
      page.locator(`[data-testid=buy-pattern-option][data-code=${code}] .buy-pattern-ticket`),
    ).toHaveCount(15)
  const option = (code) => page.locator(`[data-testid=buy-pattern-option][data-code=${code}]`)
  // 처음에는 전부터 쓰던 양옆이다.
  await expect(option('sides')).toHaveAttribute('aria-pressed', 'true')
  const box = await page.getByTestId('buy-pattern').boundingBox()
  assert(box && box.x >= 0 && box.x + box.width <= width, 'the picker fits the screen')
  await option('center').scrollIntoViewIfNeeded()
  await option('center').click()
  await expect(option('center')).toHaveAttribute('aria-pressed', 'true')
  await expect(option('sides')).toHaveAttribute('aria-pressed', 'false')
  await expect(option('center')).toContainText('사용 중')
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
  // 손을 댄 자리로 쏘기 (718번): 화면 왼쪽을 누르고 있으면 가운데 패턴이어도 주문이 그 자리에서 뜬다. 떼면 패턴으로 돌아간다.
  await page.mouse.move(70, 330)
  await page.mouse.down()
  await expect
    .poll(async () => ((await orders()) ?? []).filter((x) => Math.abs(x - 70) < 45).length, {
      timeout: 40000,
    })
    .toBeGreaterThan(2)
  await page.mouse.up()
  await expect
    .poll(async () => ((await orders()) ?? []).filter((x) => x < width * 0.3).length, {
      timeout: 40000,
    })
    .toBe(0)
  // 다시 열어도 고른 패턴이 남아 있다.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=idle-canvas] canvas').waitFor()
  await page.locator('[data-tutorial-menu=cats]').click()
  await page.getByRole('tab', { name: '매수 티켓', exact: true }).click()
  await expect(option('center')).toHaveAttribute('aria-pressed', 'true')
  assert.deepEqual(errors, [])
  console.log('buy pattern ok')
} finally {
  await browser.close()
}
