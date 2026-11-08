/// <reference lib="dom" />
/** 개발 서버에서 실제 앱을 검증한다. API만 fixture로 대체: node scripts/toyCityCheck.ts */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/toy-city')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
  let company = {
    ...structuredClone(fixture),
    grade: 'F',
    seats: 4,
    capital: 10_000_000_000,
    lastSettlement: null,
    mental: null,
    upgrade: {
      to: 'E',
      cost: 100_000_000,
      needed: 200_000_000,
      affordable: true,
      years: 0,
      left: null as number | null,
    },
  }
  let mode: 'reject' | 'construction' | 'grow' = 'reject'
  let step = 0
  const grades = ['E', 'D', 'C', 'B', 'A']
  const capacities = [6, 10, 14, 18, 22]
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (route.request().url().endsWith('/upgrade')) {
      if (mode === 'reject')
        return route.fulfill({ status: 400, json: { message: '확장 조건을 다시 확인해주세요.' } })
      if (mode === 'construction')
        company = { ...company, upgrade: { ...company.upgrade, years: 2, left: 2 } }
      else {
        company = {
          ...company,
          grade: grades[step],
          seats: capacities[step],
          upgrade: { ...company.upgrade, to: grades[step + 1] ?? 'S', years: 0, left: null },
        }
        step++
      }
    }
    return route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
  const home = page.getByTestId('office-scene')
  await expect(home).toBeVisible()
  const employees = company.employees.filter((e) => e.desk).length
  await expect(home.getByTestId('toy-employee')).toHaveCount(employees)
  await expect(page.getByTestId('toy-desk')).toHaveCount(0)
  await expect(page.getByTestId('office-seat')).toHaveCount(0)
  await page.screenshot({ path: resolve(out, 'home.png') })

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await expect(page.getByTestId('toy-settings-sheet')).toBeFocused()
  await page.keyboard.press('Tab')
  assert(
    await page
      .getByTestId('toy-settings-sheet')
      .evaluate((el) => el.contains(document.activeElement)),
  )
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('toy-settings-sheet')).toHaveCount(0)

  await page.getByTestId('tab-staff').click()
  await expect(page.getByTestId('desk-row').first()).toBeVisible()
  await page.getByTestId('desk-row').first().click()
  await page.getByRole('button', { name: '닫기 ✕' }).click()
  await page.getByTestId('tab-office').click()
  for (const tab of ['market', 'issue']) {
    await page.getByTestId(`tab-${tab}`).click()
    await page.getByTestId('tab-office').click()
    await expect(home).toBeVisible()
  }

  await page.getByTestId('open-upgrade').click()
  await page.getByTestId('upgrade').click()
  await expect(page.getByTestId('toy-upgrade-sheet').getByRole('alert')).toHaveText(
    '확장 조건을 다시 확인해주세요.',
  )
  await expect(page.getByTestId('move-scene')).toHaveCount(0)
  mode = 'construction'
  await page.getByTestId('upgrade').click()
  await expect(page.getByTestId('construction')).toContainText('2년')
  await expect(page.getByTestId('move-scene')).toHaveCount(0)
  company.upgrade = { ...company.upgrade, years: 0, left: null }
  await page.reload()
  mode = 'grow'
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('open-upgrade').click()
    await page.getByTestId('upgrade').click()
    const move = page.getByTestId('move-scene')
    await expect(move).toBeVisible()
    await expect(move.getByTestId('toy-street')).toHaveAttribute(
      'data-direction',
      i % 2 ? 'right' : 'left',
    )
    await expect(move.getByTestId('toy-street')).toHaveAttribute('data-phase', '3')
    await expect(move.getByTestId('toy-employee')).toHaveCount(employees)
    await page.screenshot({ path: resolve(out, `expansion-${i + 1}.png`) })
    await move.getByRole('button').click()
    await expect(home.getByTestId('toy-street')).toHaveAttribute(
      'data-seats',
      String(capacities[i]),
    )
  }
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [480, 960],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height })
    await page.screenshot({ path: resolve(out, `home-${width}x${height}.png`) })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await expect(page.getByTestId('settle')).toBeEnabled()
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.getByTestId('move-scene')).toHaveCount(0)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: navigation, no desks, dialog focus, API rejection, construction, five alternating expansions, real employee count, responsive viewports, reload',
  )
} finally {
  await browser.close()
}
