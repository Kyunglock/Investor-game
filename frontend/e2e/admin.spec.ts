import { expect, test } from '@playwright/test'

// 관리자 플레이 기록 (decisions.md 46번). 토큰은 playwright.config.ts의 webServer env.

test('토큰이 틀리면 기록을 보여 주지 않는다', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('wrong')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByRole('alert')).toHaveText('토큰이 맞지 않습니다.')
})

test('회사를 차리면 플레이 기록에 보인다', async ({ page }) => {
  // 게임 화면은 앱(/app/)에 있어 회사는 API로 차린다. 같은 문맥이라 세션 쿠키를 함께 쓴다.
  expect((await page.request.post('/api/sessions')).ok()).toBe(true)
  expect((await page.request.post('/api/company')).ok()).toBe(true)

  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('e2e-admin-token')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByTestId('admin-summary')).toContainText('회사')
  // 가장 최근에 차린 회사가 맨 위다.
  await expect(page.getByTestId('admin-company').first()).toContainText('1호 · 도는 중')
  await expect(page.getByTestId('admin-dropoff')).toContainText('첫 회사')
})
