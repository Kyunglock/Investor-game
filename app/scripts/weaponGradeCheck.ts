/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { company } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/weapon-grades')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(
  process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : { channel: process.env.BROWSER_CHANNEL || 'msedge' },
)
const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SR', 'UR', 'LR']
const kinds = [
  'pistol',
  'pistol',
  'revolver',
  'smg',
  'smg',
  'shotgun',
  'rifle',
  'rifle',
  'rifle',
  'rifle',
  'rifle',
  'rifle',
]
const damage = [100, 160, 450, 165, 230, 1980, 1815, 3177, 5560, 9731, 17031, 29805]
const fire = [260, 234, 510, 80, 64, 560, 360, 360, 360, 360, 360, 360]
const names = [
  '권총',
  '권총',
  '리볼버',
  '기관단총',
  '기관단총',
  '폭발포',
  '성운포',
  '성운포',
  '성운포',
  '성운포',
  '성운포',
  '성운포',
]
const weapons = grades.map((grade, i) => ({
  kind: kinds[i],
  name: names[i],
  grade,
  gradeName: grade,
  damagePercent: damage[i],
  fireMs: fire[i],
  power: i === 5 ? 2 : i >= 6 ? 3 : 0,
  bulletSpeed: i >= 6 ? 1100 : 720,
  equipped: false,
  count: 2,
}))
try {
  for (const [index, grade] of grades.entries()) {
    if (process.env.ART_ONLY) break
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    })
    const errors: string[] = []
    page.on('pageerror', (e) => {
      errors.push(e.message)
      console.error(e.message)
    })
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    let owned = weapons.map((w, i) => ({ ...w, equipped: i === index }))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      if (
        route.request().method() === 'POST' &&
        new URL(route.request().url()).pathname === '/api/company/weapon'
      ) {
        const equip = route.request().postDataJSON()
        owned = owned.map((w) => ({
          ...w,
          equipped: w.kind === equip.kind && w.grade === equip.grade,
        }))
      }
      return route.fulfill({
        json: {
          ...company,
          invest: null,
          weapons: owned,
          armory: { mergeCount: 2, lastDraw: null, lastDraws: [] },
        },
      })
    })
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5186/app/')
    await page.getByTestId('idle-battle').waitFor()
    // 무기는 고양이 메뉴의 사장냥 장비 목록에 등급 높은 순으로 있다 (530번).
    await page.getByRole('button', { name: '고양이', exact: true }).click()
    await page.getByTestId('cat-gun').click()
    await expect(page.getByTestId('cat-weapon').first()).toHaveAttribute('data-grade', 'LR')
    await page.screenshot({ path: resolve(out, `inventory-${grade}.png`) })
    await page.getByRole('button', { name: '닫기 ✕', exact: true }).click()
    await expect(page.getByTestId('idle-canvas').locator('canvas')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: resolve(out, `battle-${grade}.png`) })
    // 실제 장착 요청 후 기존 캔버스가 교체되어 새 무기 텍스처를 굽는지 확인한다.
    if (grade === 'F' || grade === 'LR') {
      const oldCanvas = await page.getByTestId('idle-canvas').locator('canvas').elementHandle()
      assert.ok(oldCanvas)
      const next = grade === 'F' ? 'LR' : 'F'
      await page.getByRole('button', { name: '고양이', exact: true }).click()
      await page.getByTestId('cat-gun').click()
      await page.locator(`[data-testid="cat-weapon"][data-grade="${next}"]`).first().click()
      await expect(page.getByTestId('cat-detail').getByTestId('cat-gun')).toContainText(next)
      await expect.poll(() => oldCanvas.evaluate((canvas) => canvas.isConnected)).toBe(false)
      await expect(page.getByTestId('idle-canvas').locator('canvas')).toHaveCount(1)
      await page.getByRole('button', { name: '닫기 ✕', exact: true }).click()
      await expect(page.getByTestId('idle-canvas').locator('canvas')).toBeVisible()
      await page.screenshot({ path: resolve(out, `equip-${grade}-to-${next}.png`) })
    }
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${grade}: six-slot inventory, pagination, merge buttons, battle, no browser errors`,
    )
    await page.close()
  }
  // 실제 총·탄·명중 원화를 같은 배율로 나란히 놓아 열두 등급을 비교한다.
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1260 },
    deviceScaleFactor: 2,
  })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5186/app/')
  await page.evaluate(async () => {
    const gunPath = '/app/src/mental/weaponArt.ts',
      fxPath = '/app/src/mental/weaponVisuals.ts'
    const { drawInventoryGun, drawEquippedHero } = await import(/* @vite-ignore */ gunPath)
    const assetPath = '/app/src/mental/assets.ts'
    const { STAGE_ASSETS } = await import(/* @vite-ignore */ assetPath)
    const load = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = url
      })
    const [weapons, hero] = await Promise.all([load(STAGE_ASSETS.weapons), load(STAGE_ASSETS.hero)])
    const { drawWeaponBullet, drawWeaponImpact, WEAPON_GRADES } = await import(
      /* @vite-ignore */ fxPath
    )
    document.body.replaceChildren()
    document.body.style.cssText = 'margin:0;background:#101b2d;color:#fff'
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 2520
    canvas.style.width = '1000px'
    document.body.append(canvas)
    const c = canvas.getContext('2d')
    if (!c) throw new Error('Canvas unavailable')
    c.scale(2, 2)
    c.font = 'bold 24px sans-serif'
    c.fillStyle = '#f8fafc'
    c.fillText('F → LR  /  무기 · 탄 · 명중', 40, 42)
    WEAPON_GRADES.forEach((grade: string, i: number) => {
      const y = 80 + i * 94
      c.fillStyle = i % 2 ? '#1a2940' : '#142238'
      c.fillRect(24, y, 952, 84)
      c.fillStyle = '#fff'
      c.font = 'bold 26px sans-serif'
      c.fillText(grade, 45, y + 48)
      c.save()
      c.translate(180, y + 32)
      drawInventoryGun(c, weapons, grade, { x: -30, y: -24, w: 105, h: 80 })
      c.restore()
      c.save()
      c.translate(430, y + 30)
      c.scale(3, 3)
      drawWeaponBullet(c, grade, 0)
      c.restore()
      c.save()
      c.translate(600, y + 2)
      drawWeaponImpact(c, grade)
      c.restore()
      c.save()
      c.translate(810, y - 8)
      c.scale(0.8, 0.8)
      drawEquippedHero(c, hero, weapons, grade)
      c.restore()
    })
  })
  await page.screenshot({ path: resolve(out, 'all-grades.png') })
} finally {
  await browser.close()
}
