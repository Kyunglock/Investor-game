import { expect, test } from '@playwright/test'

// 관리자 플레이 기록 (decisions.md 46번). 토큰은 playwright.config.ts의 webServer env.

test('토큰이 틀리면 기록을 보여 주지 않는다', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('wrong')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByRole('alert')).toHaveText('토큰이 맞지 않습니다.')
})

test('회사를 차리면 플레이 기록에 멈춘 해와 함께 보인다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '회사 차리기' }).click()
  await expect(page.getByTestId('company')).toBeVisible()

  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('e2e-admin-token')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByTestId('admin-summary')).toContainText('회사')
  // 가장 최근에 차린 회사가 맨 위다.
  await expect(page.getByTestId('admin-company').first()).toContainText('1호 · 도는 중')
  await expect(page.getByTestId('admin-company').first()).toContainText('결산 0번')
  await expect(page.getByTestId('admin-dropoff')).toContainText('1년 차')
})
