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
    mental: { genre: 'DEFENSE', headline: '불안한 소문이 거리를 가득 채웠어요', done: false },
    stages: {
      best: 0,
      last: 10,
      perChapter: 10,
      stars: [] as number[],
      bonusPercent: 0,
      exAvailable: true,
      lastResult: null as null | Record<string, unknown>,
    },
    armory: { tickets: 0, mergeCount: 2, lastDraw: null },
    weapons: [
      {
        kind: 'pistol',
        name: '권총',
        grade: 'N',
        gradeName: '일반',
        damagePercent: 100,
        fireMs: 260,
        power: 1,
        bulletSpeed: 720,
        equipped: true,
        count: 1,
      },
      {
        kind: 'pistol',
        name: '권총',
        grade: 'R',
        gradeName: '희귀',
        damagePercent: 120,
        fireMs: 240,
        power: 1,
        bulletSpeed: 720,
        equipped: false,
        count: 1,
      },
    ],
    upgrade: { ...fixture.upgrade, years: 2, left: null },
  }
  let reports = 0
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
    if (path.endsWith('/stage')) {
      reports++
      if (reports === 1)
        return route.fulfill({
          status: 400,
          json: { message: '연결을 확인하고 다시 저장해주세요.' },
        })
      const { stage, cleared, stars } = route.request().postDataJSON()
      company = {
        ...company,
        stages: {
          ...company.stages,
          lastResult: { stage, cleared, stars, firstClear: false, capital: 0, tickets: 0 },
        },
      }
    }
    await route.fulfill({ json: company })
  })
  /** 위의 흰 판 없이 조각이 제자리에 있는지 (decisions.md 390번): 레벨은 왼쪽 가장자리, 시간·일시정지는 오른쪽 위, 멘탈 게이지는 멘탈벽 그림 위. */
  const checkHud = async () => {
    const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
    const box = async (id: string) => {
      const b = await page.getByTestId(id).boundingBox()
      assert(b, id)
      return b
    }
    const level = await box('battle-level')
    assert(level.x >= 0 && level.x + level.width <= 50, 'level at left edge')
    assert(level.height > level.width * 3, 'level stands vertical')
    const timer = await box('battle-timer')
    const pause = await box('mental-quit')
    assert(timer.x > width / 2 && pause.x + pause.width <= width, 'timer and pause at top right')
    assert(timer.y + timer.height < 70 && pause.y + pause.height < 70, 'corner stays small')
    // 멘탈벽 줄은 stageArt.ts wallOffset과 같다. 벽 그림은 그 줄 위 24px ~ 아래 48px.
    const wallY = height - Math.max(150, Math.min(230, height * 0.26))
    const wall = await box('battle-wall')
    assert(wall.y >= wallY && wall.y + wall.height <= wallY + 48, 'mental gauge on the wall')
  }
  const base = process.env.APP_URL ?? 'http://127.0.0.1:5182/app/'
  await page.goto(base)
  await page.getByTestId('stage-open').click()
  await page.locator('[data-testid=stage][data-stage="1"]').click()
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
  await expect(page.getByTestId('battle-timer')).toHaveText('2:00')
  await page.screenshot({ path: resolve(out, 'cards.png') })
  await page.getByTestId('mental-cards').getByRole('button').first().click()
  await page.clock.runFor(400)
  await expect(page.getByTestId('mental-cards')).toHaveCount(0)
  await page.clock.runFor(5000)
  await checkHud()
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
  await checkHud()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(100)
  // 2분 판은 레벨이 빨리 올라 그사이 카드 고르기가 떠 있을 수 있다.
  if (await page.getByTestId('mental-cards').count()) {
    await page.getByTestId('mental-cards').getByRole('button').first().click()
    await page.clock.runFor(400)
  }
  await page.getByTestId('mental-quit').click()
  await expect(page.getByTestId('mental-quit-ask')).toBeVisible()
  const pausedTime = await page.getByTestId('battle-timer').textContent()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('battle-timer')).toHaveText(pausedTime ?? '')
  await page.screenshot({ path: resolve(out, 'pause.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('mental-quit-ask')).toHaveCount(0)
  // 아래로 쏘아 멘탈벽의 피격·균열·패배 및 저장 재시도를 실제 전투로 확인한다. 깎이는 것은 벽 위의 게이지에서 보인다.
  const mentalNow = () =>
    page
      .getByRole('progressbar', { name: '멘탈벽 내구도' })
      .getAttribute('aria-valuenow')
      .then(Number)
  const fullMental = await mentalNow()
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
    if (i === 2) {
      assert((await mentalNow()) < fullMental, 'wall gauge drops')
      await page.screenshot({ path: resolve(out, 'wall-contact.png') })
    }
  }
  await page.mouse.up()
  await expect(page.getByTestId('mental-result')).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: '멘탈 전투', exact: true }).getByRole('alert'),
  ).toContainText('연결을 확인')
  await page.screenshot({ path: resolve(out, 'result.png') })
  await page.getByTestId('mental-done').click()
  await expect(page.getByTestId('mental-reward')).toHaveText('깨면 자본과 무기 뽑기권을 받는다.')
  assert.equal(reports, 2)
  await page.getByTestId('mental-done').click()
  await expect(page.getByTestId('mental-result')).toHaveCount(0)
  // 두 장르 모두 같은 방어선·로딩 복구를 지원한다.
  company = { ...company, mental: { ...company.mental, genre: 'ASSAULT', done: false } }
  const enemyAsset = /\/assets\/enemies(?:-[\w-]+)?\.png$/
  await page.route(enemyAsset, (route) => route.fulfill({ status: 404, body: '' }))
  await page.reload()
  await page.getByTestId('stage-open').click()
  await page.locator('[data-testid=stage][data-stage="1"]').click()
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
    'PASS: stage pick, lobby, equipment, real Phaser/sprites, first card pause, HUD layout, aiming, wall gauge damage, pause/resume, loss, failed save/retry, both genres, asset load retry, quit cleanup',
  )
} finally {
  await browser.close()
}
