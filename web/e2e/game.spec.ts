import { expect, type Page, test } from '@playwright/test'

// 워킹 스켈레톤의 흐름을 실제 브라우저·서버·DB로 확인한다.
// 시계는 page.clock으로 감아서 10분짜리 판을 몇 초 만에 검증한다.

async function bornAndWait(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '태어나기' }).click()
  // 판이 화면에 뜬 뒤에 시계를 감아야 시계가 그 시간을 받는다.
  await expect(page.getByTestId('age')).toHaveText('25세 0개월')
}

test('처음 방문하면 태어나기를 고를 수 있다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '태어나기' })).toBeVisible()
})

test('태어나면 능력치와 현금이 보이고 25세에서 시작한다', async ({ page }) => {
  await bornAndWait(page)

  await expect(page.getByTestId('cash')).toContainText('원')
  for (const stat of ['insight', 'patience', 'courage', 'conviction', 'luck']) {
    await expect(page.getByTestId(`stat-${stat}`)).toBeVisible()
  }
  await expect(page.getByTestId('reported-day')).toHaveText('서버 확인: 0일')
})

test('시간이 흐르면 나이가 들고 서버에 보고되며, 새로고침하면 일시정지 상태로 이어한다', async ({
  page,
}) => {
  await page.clock.install()
  await bornAndWait(page)
  const insight = await page.getByTestId('stat-insight').textContent()

  // 1년은 15초다. 16초를 감으면 26세가 되고 보고 간격(90일)을 여러 번 지난다.
  await page.clock.runFor(16_000)
  await expect(page.getByTestId('age')).toContainText('26세')
  await expect(page.getByTestId('reported-day')).not.toHaveText('서버 확인: 0일')

  // 일시정지하면 현재 시각을 서버에 보고한다. 그 응답을 기다린 뒤 값을 읽는다.
  const paused = page.waitForResponse((r) => r.url().includes('/advance') && r.ok())
  await page.getByRole('button', { name: '일시정지' }).click()
  await paused
  const reported = await page.getByTestId('reported-day').textContent()

  await page.reload()
  await expect(page.getByRole('button', { name: '계속' })).toBeVisible()
  await expect(page.getByTestId('reported-day')).toHaveText(reported ?? '')
  await expect(page.getByTestId('age')).toContainText('26세')
  await expect(page.getByTestId('stat-insight')).toHaveText(insight ?? '')
})

test('다시 시작하면 새 판이 25세에서 시작한다', async ({ page }) => {
  await page.clock.install()
  await bornAndWait(page)
  await page.clock.runFor(16_000)
  await expect(page.getByTestId('age')).toContainText('26세')

  await page.getByRole('button', { name: '다시 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('25세 0개월')
  await expect(page.getByTestId('reported-day')).toHaveText('서버 확인: 0일')
})
