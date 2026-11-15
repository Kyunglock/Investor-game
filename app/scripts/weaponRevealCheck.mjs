import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

mkdirSync('/tmp/weapon-shots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    for (const grade of ['F', 'D', 'B', 'S']) {
      if (process.env.GRADE && grade !== process.env.GRADE) continue
      const page = await browser.newPage({ viewport: { width, height } })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      const weapon = {
        kind: grade === 'S' ? 'rifle' : 'pistol',
        name: grade === 'S' ? '성운 소총' : '권총',
        grade,
        gradeName: grade,
        damagePercent: 200,
        fireMs: 200,
        power: 1,
        bulletSpeed: 720,
        equipped: true,
        count: 1,
      }
      let company = {
        ...fixture,
        weapons: [weapon],
        // 다이아 200개: 한 번 뽑기(100)를 두 번 한다 (526번).
        diamonds: { ...fixture.diamonds, amount: 200 },
        armory: { mergeCount: 3, lastDraw: null, lastDraws: [] },
        // 뽑기 자리는 자동 전투가 있는 회사에만 있다.
        idle: {
          wall: 1,
          hp: 120,
          maxHp: 120,
          dps: 12,
          earned: 0,
          boss: false,
          skills: [],
          cats: [],
          fieldSlots: 4,
          wallDps: 0,
          income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
        },
      }
      let calls = 0
      let reject = true
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
        if (route.request().url().endsWith('/weapon/draw')) {
          calls++
          await new Promise((resolve) => setTimeout(resolve, 200))
          if (reject) return route.fulfill({ status: 400, json: { message: '뽑기 실패 테스트' } })
          company = {
            ...company,
            diamonds: {
              ...company.diamonds,
              amount: company.diamonds.amount - company.diamonds.draw,
            },
            armory: {
              ...company.armory,
              lastDraw: {
                kind: weapon.kind,
                name: weapon.name,
                grade,
                gradeName: grade,
                isNew: company.diamonds.amount === 200,
              },
            },
          }
        }
        return route.fulfill({ json: company })
      })
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
      // 무기 뽑기는 고양이 메뉴의 뽑기 자리에서 고른다 (530번).
      await page.getByRole('button', { name: '고양이' }).click()
      await page.getByTestId('draw-kind-weapon').click()
      await page.getByTestId('weapon-draw').click()
      await expect(page.getByTestId('weapon-reveal')).toBeVisible()
      await expect(page.getByTestId('weapon-reveal')).not.toHaveAttribute('data-grade', /.+/)
      await expect(page.getByTestId('weapon-reveal')).toHaveCount(0)
      await expect(page.getByTestId('weapon-draw')).toBeEnabled()
      reject = false
      await page.getByTestId('weapon-draw').click()
      await expect(page.getByTestId('weapon-reveal')).toHaveAttribute('data-grade', grade)
      await page.screenshot({ path: `/tmp/weapon-shots/${width}-${grade}-charge.png` })
      await expect(page.getByTestId('weapon-drawn')).toBeVisible()
      await expect(page.getByTestId('weapon-drawn')).toContainText('NEW!')
      await expect(page.getByTestId('weapon-drawn')).toContainText('공격력 ×4')
      await page.waitForTimeout(450)
      await page.screenshot({ path: `/tmp/weapon-shots/${width}-${grade}-result.png` })
      const bounds = await page.getByTestId('weapon-reveal-again').boundingBox()
      assert(bounds && bounds.x >= 0 && bounds.y + bounds.height <= height)
      await page.getByTestId('weapon-reveal-again').click()
      await expect(page.getByTestId('weapon-reveal')).toHaveAttribute('data-grade', grade)
      await page.getByTestId('weapon-reveal-skip').click()
      await expect(page.getByTestId('weapon-drawn')).toContainText('합성 재료 +1')
      await page.waitForTimeout(2400)
      await expect(page.getByTestId('weapon-drawn')).toBeVisible()
      await expect(page.getByTestId('weapon-reveal-again')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('weapon-reveal')).toHaveCount(0)
      await expect(page.getByTestId('idle-menu')).toBeVisible()
      await expect(page.getByTestId('idle-diamonds')).toHaveText('0')
      await expect(page.getByTestId('weapon-draw')).toBeDisabled()
      assert.equal(calls, 3)
      assert.deepEqual(errors, [])
      // Reduced motion: successful response shows result immediately, without animation.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      company.diamonds.amount = 100
      await page.reload()
      // 무기 뽑기는 고양이 메뉴의 뽑기 자리에서 고른다 (530번).
      await page.getByRole('button', { name: '고양이' }).click()
      await page.getByTestId('draw-kind-weapon').click()
      await page.getByTestId('weapon-draw').click()
      await expect(page.getByTestId('weapon-drawn')).toBeVisible()
      const animation = await page
        .getByTestId('weapon-drawn')
        .evaluate((el) => getComputedStyle(el).animationName)
      assert.equal(animation, 'none')
      console.log(width, grade, '실패 복구·신규·중복·다시 뽑기·건너뛰기·Escape·움직임 줄이기 OK')
      await page.close()
    }
  }
} finally {
  await browser.close()
}
