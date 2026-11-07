/**
 * 앱 화면을 폰 크기로 찍는다 (docs/app.md). 서버 없이 /api를 가짜 회사(fixture.ts)로 막는다: `pnpm dev`를 띄운 뒤 `node scripts/shot.ts`.
 * 크로미움이 Playwright 기본 자리에 없으면 CHROMIUM_PATH로 알려 준다. 결과는 scripts/shots/*.png.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, devices } from '@playwright/test'
import { company } from './fixture.ts'

const base = process.env.APP_URL ?? 'http://localhost:5173/app/'
const out = resolve(import.meta.dirname, 'shots')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const context = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 })
const page = await context.newPage()
// 서버 API만 막는다: Vite가 주는 src/api/client.ts 같은 모듈 주소와 겹치지 않게 경로를 좁힌다.
await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
  const url = route.request().url()
  if (url.endsWith('/api/company') && route.request().method() === 'GET') {
    return route.fulfill({
      json: process.env.EMPTY ? null : company,
      status: process.env.EMPTY ? 404 : 200,
    })
  }
  return route.fulfill({ json: company })
})
const shot = async (name: string) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(out, `${name}.png`) })
  console.log(name)
}

await page.goto(base)
if (process.env.EMPTY) {
  await page.getByTestId('touch-to-start').waitFor()
  await shot('title')
  await page.getByTestId('touch-to-start').click()
  await shot('title-start')
} else {
  await page.getByTestId('shell').waitFor()
  await shot('office')
  await page.getByTestId('office-seat').first().click()
  await shot('office-seat-sheet')
  await page.getByRole('button', { name: '닫기 ✕' }).click()
  await page.getByTestId('tab-market').click()
  await shot('market')
  await page.getByTestId('tab-staff').click()
  await shot('staff')
  await page.getByTestId('desk-row').first().click()
  await shot('staff-desk-sheet')
  await page.getByRole('button', { name: '닫기 ✕' }).click()
  await page.getByTestId('tab-issue').click()
  await shot('issue')
  await page.getByTestId('tab-record').click()
  await shot('record')
}
await browser.close()
