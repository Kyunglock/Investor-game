/// <reference lib="dom" />
/** 실제 앱 + Phaser, API만 가짜 응답. APP_URL/BROWSER_CHANNEL/CHROMIUM_PATH 지원. */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/stage')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await page.clock.install()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
  let company = {
    ...structuredClone(fixture),
    invest: null,
    lastSettlement: null,
    mental: {
      genre: 'DEFENSE',
      headline: '불안한 소문이 거리를 가득 채웠어요',
      done: false,
      drop: null as null | {
        kind: string
        name: string
        grade: string
        gradeName: string
        isNew: boolean
      },
    },
    weapons: [
      {
        kind: 'pistol',
        name: '권총',
        grade: 'N',
        gradeName: '일반',
        damagePercent: 100,
        fireMs: 260,
        streams: 1,
        bulletSpeed: 720,
        equipped: true,
      },
      {
        kind: 'pistol',
        name: '권총',
        grade: 'R',
        gradeName: '희귀',
        damagePercent: 120,
        fireMs: 240,
        streams: 1,
        bulletSpeed: 720,
        equipped: false,
      },
    ],
    upgrade: { ...fixture.upgrade, years: 2, left: null },
  }
  let reports = 0
  let settlements = 0
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/weapon')) {
      const selected = route.request().postDataJSON()
      company = {
        ...company,
        weapons: company.weapons.map((w) => ({
          ...w,
          equipped: w.kind === selected.kind && w.grade === selected.grade,
        })),
      }
    }
    if (path.endsWith('/mental')) {
      reports++
      assert(route.request().postDataJSON().cards.length > 0)
      if (reports === 1)
        return route.fulfill({
          status: 400,
          json: { message: '연결을 확인하고 다시 저장해주세요.' },
        })
      company = {
        ...company,
        mental: {
          ...company.mental,
          done: true,
          drop: { kind: 'pistol', name: '권총', grade: 'R', gradeName: '희귀', isNew: false },
        },
      }
    }
    if (path.endsWith('/settle')) {
      settlements++
      company = { ...company, quarter: company.quarter + 1 }
    }
    await route.fulfill({ json: company })
  })
  const base = process.env.APP_URL ?? 'http://127.0.0.1:5182/app/'
  await page.goto(base)
  await page.getByTestId('settle').click()
  await expect(page.getByTestId('mental-lobby')).toBeVisible()
  await page.locator('[data-testid=weapon][data-grade=R]').click()
  await expect(page.locator('[data-testid=weapon][data-grade=R]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.screenshot({ path: resolve(out, 'lobby.png') })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.getByTestId('mental-start').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(out, 'lobby-small.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mental-start').click()
  await expect(page.getByTestId('mental-cards')).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('battle-timer')).toHaveText('4:00')
  await page.screenshot({ path: resolve(out, 'cards.png') })
  await page.getByTestId('mental-cards').getByRole('button').first().click()
  await page.clock.runFor(400)
  await expect(page.getByTestId('mental-cards')).toHaveCount(0)
  await page.clock.runFor(5000)
  await page.screenshot({ path: resolve(out, 'battle.png') })
  await page.waitForTimeout(2100)
  await page.screenshot({
    path: resolve(out, 'battle-preview.jpg'),
    type: 'jpeg',
    quality: 85,
    scale: 'css',
  })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.clock.runFor(100)
  await page.screenshot({ path: resolve(out, 'battle-small.png') })
  assert(await page.getByTestId('battle-hud').evaluate((el) => el.scrollWidth <= el.clientWidth))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(100)
  await page.getByTestId('mental-quit').click()
  await expect(page.getByTestId('mental-quit-ask')).toBeVisible()
  const pausedTime = await page.getByTestId('battle-timer').textContent()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('battle-timer')).toHaveText(pausedTime ?? '')
  await page.screenshot({ path: resolve(out, 'pause.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('mental-quit-ask')).toHaveCount(0)
  // 아래로 쏘아 멘탈벽의 피격·균열·패배 및 저장 재시도를 실제 전투로 확인한다.
  await page.mouse.move(195, 800)
  await page.mouse.down()
  for (let i = 0; i < 16 && (await page.getByTestId('mental-result').count()) === 0; i++) {
    await page.clock.runFor(5000)
    if (await page.getByTestId('mental-cards').count()) {
      await page.mouse.up()
      await page.getByTestId('mental-cards').getByRole('button').first().click()
      await page.clock.runFor(400)
      await page.mouse.move(195, 800)
      await page.mouse.down()
    }
    if (i === 2) await page.screenshot({ path: resolve(out, 'wall-contact.png') })
  }
  await page.mouse.up()
  await expect(page.getByTestId('mental-result')).toBeVisible()
  await page.screenshot({ path: resolve(out, 'result.png') })
  await page.getByTestId('mental-done').click()
  await expect(
    page.getByRole('dialog', { name: '멘탈 전투', exact: true }).getByRole('alert'),
  ).toContainText('연결을 확인')
  assert.equal(settlements, 0)
  await expect(page.getByTestId('mental-result')).toBeVisible()
  await page.getByTestId('mental-done').click()
  await expect(page.getByTestId('mental-result')).toHaveCount(0)
  assert.equal(reports, 2)
  assert.equal(settlements, 0)
  await expect(page.getByTestId('mental-drop')).toBeVisible()
  await page.screenshot({ path: resolve(out, 'drop.png') })
  await page.getByTestId('mental-drop-done').click()
  assert.equal(settlements, 1)
  // 두 장르 모두 같은 방어선·로딩 복구를 지원한다.
  company = { ...company, mental: { ...company.mental, genre: 'ASSAULT', done: false } }
  const enemyAsset = /\/assets\/enemies(?:-[\w-]+)?\.png$/
  await page.route(enemyAsset, (route) => route.fulfill({ status: 404, body: '' }))
  await page.reload()
  await page.getByTestId('settle').click()
  await page.getByTestId('mental-start').click()
  await expect(
    page.getByRole('dialog', { name: '멘탈 전투', exact: true }).getByRole('alert'),
  ).toContainText('전장 그림', { timeout: 30000 })
  await page.unroute(enemyAsset)
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByTestId('mental-cards')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('mental-quit-ask')).toBeVisible()
  await page.getByTestId('mental-quit-yes').click()
  await expect(page.getByTestId('battle-canvas')).toHaveCount(0)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: lobby, equipment, real Phaser/sprites, first card pause, aiming, wall damage, pause/resume, loss, failed save/retry, both genres, asset load retry, quit cleanup',
  )
} finally {
  await browser.close()
}
