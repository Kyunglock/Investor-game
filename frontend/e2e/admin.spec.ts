import { expect, test } from '@playwright/test'

// 관리자 플레이 기록 (decisions.md 46번). 토큰은 playwright.config.ts의 webServer env.

test('토큰이 틀리면 기록을 보여 주지 않는다', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('wrong')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByRole('alert')).toHaveText('토큰이 맞지 않습니다.')
})

test('태어나면 그 판이 플레이 기록에 보인다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '태어나기' }).click()
  // 태어나기를 누르면 서버에 새 판이 생긴다.
  await expect(page.getByTestId('birth-reveal')).toBeVisible()

  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('e2e-admin-token')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByTestId('admin-summary')).toBeVisible()
  // 가장 최근에 시작한 판이 맨 위다.
  await expect(page.getByTestId('admin-play').first()).toContainText('진행 중')
  await expect(page.getByTestId('admin-play').first()).toContainText('15→15세')
})
