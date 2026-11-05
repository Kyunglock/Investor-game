import { expect, test } from '@playwright/test'

// 관리자 플레이 기록 (decisions.md 46번). 토큰은 playwright.config.ts의 webServer env.

test('토큰이 틀리면 기록을 보여 주지 않는다', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('wrong')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByRole('alert')).toHaveText('토큰이 맞지 않습니다.')
})

test('육성 판을 시작하면 플레이 기록에 멈춘 카드와 함께 보인다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '수습 시작' }).click()
  await expect(page.getByTestId('run-card')).toBeVisible()

  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('e2e-admin-token')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByTestId('admin-summary')).toContainText('육성 판')
  // 가장 최근에 시작한 판이 맨 위다.
  await expect(page.getByTestId('admin-run').first()).toContainText('진행 중 · 첫 판')
  await expect(page.getByTestId('admin-run').first()).toContainText('1/12 성향')
  await expect(page.getByTestId('admin-dropoff')).toContainText('1번째')
})
