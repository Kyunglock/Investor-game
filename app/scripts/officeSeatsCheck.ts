import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

mkdirSync('/tmp/office-shots', { recursive: true })
const browser = await chromium.launch()
try {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    for (const seats of [5, 6, 10, 11]) {
      const page = await browser.newPage({ viewport: { width, height } })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      const company = { ...fixture, seats, grade: 'F', lastSettlement: null, mental: null }
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
        route.fulfill({ json: company }),
      )
      await page.goto('http://127.0.0.1:5182/app/')
      await expect(page.getByTestId('toy-desk')).toHaveCount(seats)
      await expect(page.getByTestId('toy-employee')).toHaveCount(
        Math.min(seats, company.employees.filter((e) => e.desk).length),
      )
      await expect(page.getByTestId('stage-open')).toBeVisible()
      const bounds = await page.getByTestId('stage-open').boundingBox()
      assert(bounds && bounds.x >= 0 && bounds.y + bounds.height <= height)
      await page.screenshot({ path: `/tmp/office-shots/${width}-${seats}.png` })
      await page.getByTestId('stage-open').click()
      await expect(page.getByTestId('toy-stage-sheet')).toBeVisible()
      assert.deepEqual(errors, [])
      await page.close()
    }
  }
  console.log('5/6/10/11석, 320/390px: 자리 보존·직원·전투 진입 확인')
} finally {
  await browser.close()
}
