import { expect, test } from '@playwright/test'

// 관리자 플레이 기록 (decisions.md 46번). 토큰은 playwright.config.ts의 webServer env.

test('토큰이 틀리면 기록을 보여 주지 않는다', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('관리자 토큰').fill('wrong')
  await page.getByRole('button', { name: '보기' }).click()
  await expect(page.getByRole('alert')).toHaveText('토큰이 맞지 않습니다.')
})
