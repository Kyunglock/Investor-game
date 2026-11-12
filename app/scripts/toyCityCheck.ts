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
  await expect(page.getByTestId('toy-desk')).toHaveCount(company.seats)
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
  for (const tab of ['market', 'issue', 'record']) {
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
    if (i === 0) {
      // 확장 연출의 중간 장면 (399번): 힘 모으기 → 쾅 → 밀어내기 → 축하. 마지막엔 효과가 모두 사라진다.
      // 부딪힘(1단계)은 0.2초뿐이라 expect의 폴링으로는 놓친다: 프레임마다 단계를 본다.
      const reach = (phase: number) =>
        page.waitForFunction(
          (n) =>
            Number(
              document
                .querySelector('[data-testid="move-scene"] [data-testid="toy-street"]')
                ?.getAttribute('data-phase'),
            ) >= n,
          phase,
          { polling: 'raf' },
        )
      await page.screenshot({ path: resolve(out, 'expansion-0-windup.png') })
      await reach(1)
      await page.waitForTimeout(60)
      await page.screenshot({ path: resolve(out, 'expansion-1-impact.png') })
      await reach(2)
      await expect(move.getByTestId('toy-eviction')).toHaveCount(1)
      await page.waitForTimeout(100)
      await page.screenshot({ path: resolve(out, 'expansion-2-evict.png') })
      await reach(3)
      await expect(move.getByTestId('move-banner')).toBeVisible()
      await expect(move.getByTestId('toy-celebration')).toHaveCount(1)
      await page.waitForTimeout(250)
      await page.screenshot({ path: resolve(out, 'expansion-3-celebrate.png') })
    }
    if (i === 1) {
      // 화면을 누르면 연출을 건너뛰고 끝 모습으로 간다.
      await move.getByTestId('toy-street').click({ position: { x: 60, y: 420 } })
      await expect(move).toBeVisible()
    }
    await expect(move.getByTestId('toy-street')).toHaveAttribute('data-phase', '4')
    await expect(move.getByTestId('toy-impact')).toHaveCount(0)
    await expect(move.getByTestId('move-banner')).toHaveCount(0)
    await expect(move.getByTestId('toy-employee')).toHaveCount(employees)
    // 밀어낸 쪽은 빈자리로 끝난다 (415번).
    await expect(move.getByTestId('toy-empty-lot')).toHaveCount(1)
    await page.screenshot({ path: resolve(out, `expansion-${i + 1}.png`) })
    await move.getByRole('button').click()
    // 사무실에 돌아오면 그 자리에 새 라이벌이 밑에서 위로 지어지고, 한 번만이다 (415번).
    await expect(home.locator('[data-rise="true"]')).toHaveCount(1)
    await expect(home.getByTestId('toy-empty-lot')).toHaveCount(0)
    if (i === 0) {
      await page.waitForTimeout(500)
      await page.screenshot({ path: resolve(out, 'expansion-rise-mid.png') })
    }
    await expect(home.locator('[data-rise="true"]')).toHaveCount(0, { timeout: 4000 })
    if (i === 0) await page.screenshot({ path: resolve(out, 'expansion-rise-done.png') })
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
  // 움직임 줄이기: 확장해도 연출 없이 바로 끝 모습이다.
  await page.setViewportSize({ width: 390, height: 844 })
  grades.push('S')
  capacities.push(26)
  await page.reload()
  await page.getByTestId('open-upgrade').click()
  await page.getByTestId('upgrade').click()
  const still = page.getByTestId('move-scene')
  await expect(still.getByTestId('toy-street')).toHaveAttribute('data-phase', '4', { timeout: 300 })
  await expect(still.getByTestId('toy-impact')).toHaveCount(0)
  await expect(still.getByTestId('move-banner')).toHaveCount(0)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: navigation, no desks, dialog focus, API rejection, construction, five alternating expansions with impact/evict/celebrate frames, empty lot and rival rising once, tap-to-skip, real employee count, responsive viewports, reduced motion',
  )
} finally {
  await browser.close()
}
