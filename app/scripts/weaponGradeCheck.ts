/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { company } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/weapon-grades')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' })
const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S']
const kinds = ['pistol', 'pistol', 'revolver', 'smg', 'smg', 'shotgun', 'rifle']
const damage = [100, 160, 450, 165, 230, 1980, 1815]
const fire = [260, 234, 510, 80, 64, 560, 360]
const names = ['권총', '권총', '리볼버', '기관단총', '기관단총', '폭발포', '성운포']
const weapons = grades.map((grade, i) => ({
  kind: kinds[i],
  name: names[i],
  grade,
  gradeName: grade,
  damagePercent: damage[i],
  fireMs: fire[i],
  power: i === 5 ? 2 : i === 6 ? 3 : 0,
  bulletSpeed: i === 6 ? 1100 : 720,
  equipped: false,
  count: 2,
}))
try {
  for (const [index, grade] of grades.entries()) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
      route.fulfill({
        json: {
          ...company,
          invest: null,
          lastSettlement: null,
          weapons: weapons.map((w, i) => ({ ...w, equipped: i === index })),
          armory: { tickets: 3, mergeCount: 2, lastDraw: null },
        },
      }),
    )
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5186/app/')
    await page.getByTestId('settle').waitFor()
    await page.evaluate(async () => {
      const path = '/app/src/app/ui.ts'
      const { useAppUi } = await import(/* @vite-ignore */ path)
      useAppUi.getState().openSheet({ kind: 'toy', panel: 'weapons' })
    })
    await expect(page.getByTestId('weapon')).toHaveCount(7)
    await expect(page.getByTestId('weapon-merge')).toHaveCount(6)
    await page.screenshot({ path: resolve(out, `inventory-${grade}.png`) })
    await page.evaluate(async () => {
      const path = '/app/src/app/ui.ts'
      const { useAppUi } = await import(/* @vite-ignore */ path)
      useAppUi.getState().startBattle({ kind: 'invest', mode: 'ASSAULT', level: 1 })
    })
    await page.getByTestId('mental-start').click()
    await expect(page.getByTestId('mental-cards')).toBeVisible()
    await page.getByTestId('mental-cards').getByRole('button').first().click()
    await page.waitForTimeout(2400)
    await expect(page.getByTestId('battle-hud')).toBeVisible()
    await page.screenshot({ path: resolve(out, `battle-${grade}.png`) })
    assert.deepEqual(errors, [])
    console.log(`PASS ${grade}: inventory, six merge buttons, battle, no browser errors`)
    await page.close()
  }
  // 실제 총·탄·명중 원화를 같은 배율로 나란히 놓아 일곱 등급을 비교한다.
  const page = await browser.newPage({
    viewport: { width: 1000, height: 760 },
    deviceScaleFactor: 2,
  })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5186/app/')
  await page.evaluate(async () => {
    const gunPath = '/app/src/mental/drawStageGun.ts',
      fxPath = '/app/src/mental/weaponVisuals.ts'
    const { drawStageGun } = await import(/* @vite-ignore */ gunPath)
    const { drawWeaponBullet, drawWeaponImpact, WEAPON_GRADES } = await import(
      /* @vite-ignore */ fxPath
    )
    document.body.replaceChildren()
    document.body.style.cssText = 'margin:0;background:#101b2d;color:#fff'
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 1520
    canvas.style.width = '1000px'
    document.body.append(canvas)
    const c = canvas.getContext('2d')
    if (!c) throw new Error('Canvas unavailable')
    c.scale(2, 2)
    c.font = 'bold 24px sans-serif'
    c.fillStyle = '#f8fafc'
    c.fillText('F → S  /  무기 · 탄 · 명중', 40, 42)
    WEAPON_GRADES.forEach((grade: string, i: number) => {
      const y = 80 + i * 94
      c.fillStyle = i % 2 ? '#1a2940' : '#142238'
      c.fillRect(24, y, 952, 84)
      c.fillStyle = '#fff'
      c.font = 'bold 26px sans-serif'
      c.fillText(grade, 45, y + 48)
      c.save()
      c.translate(180, y + 32)
      c.scale(2.5, 2.5)
      drawStageGun(c, '#efcfa4', 'pistol', grade)
      c.restore()
      c.save()
      c.translate(430, y + 30)
      c.scale(3, 3)
      drawWeaponBullet(c, grade, 0)
      c.restore()
      c.save()
      c.translate(700, y + 2)
      drawWeaponImpact(c, grade)
      c.restore()
    })
  })
  await page.screenshot({ path: resolve(out, 'all-grades.png') })
} finally {
  await browser.close()
}
