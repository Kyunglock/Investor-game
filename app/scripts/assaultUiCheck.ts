/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect, type Page } from '@playwright/test'
import { company } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/assault-ui')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
type Dev = {
  __mentalAutopilot: (on: boolean) => void
  __mentalSpeed: (speed: number) => void
  __mentalMagic: (levels: Record<string, number>) => void
  __mentalWalls: () => { index: number; bottom: number; held: boolean; hp: number }[]
}

async function checkLayout(page: Page) {
  const boxes = await page
    .locator(
      '.battle-corner, .battle-price, .battle-boss, .battle-level, .battle-wall, .battle-footer, .battle-cards, .battle-price-goal, .battle-price-target',
    )
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          name: el.className,
          parents: els
            .filter((parent) => parent !== el && parent.contains(el))
            .map((parent) => parent.className),
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
        }
      }),
    )
  const { width = 0, height = 0 } = page.viewportSize() ?? {}
  if (!boxes.length && (await page.getByTestId('mental-result').count())) return
  const top = boxes.find((box) => box.name === 'battle-corner')
  assert(top && top.bottom - top.y <= 40, 'top HUD stays on one compact row')
  assert(
    !boxes.some((box) =>
      ['battle-price-goal', 'battle-price-target', 'battle-cards', 'battle-level'].includes(
        box.name,
      ),
    ),
  )
  const footer = boxes.find((box) => box.name.includes('battle-footer'))
  assert(footer && footer.bottom - footer.y <= 34, 'bottom HUD stays compact')
  for (const box of boxes) {
    assert(
      box.x >= 0 && box.right <= width + 1 && box.y >= 0 && box.bottom <= height + 1,
      `${box.name} inside viewport`,
    )
    for (const other of boxes) {
      if (box === other) continue
      // 하단 멘탈 게이지는 footer의 자식이므로 두 영역의 포함 관계는 정상이다.
      if (box.parents.includes(other.name) || other.parents.includes(box.name)) continue
      assert(
        !(
          box.x < other.right &&
          box.right > other.x &&
          box.y < other.bottom &&
          box.bottom > other.y
        ),
        `${box.name} overlaps ${other.name}`,
      )
    }
  }
}

try {
  for (const width of process.env.UI_WIDTH ? [Number(process.env.UI_WIDTH)] : [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: Number(process.env.UI_HEIGHT ?? 740) },
      deviceScaleFactor: 2,
      reducedMotion: process.env.REDUCED_MOTION ? 'reduce' : 'no-preference',
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
      route.fulfill({
        json: {
          ...company,
          invest: {
            title: '신제품 출시',
            sector: 'semiconductor',
            sectorName: '반도체',
            stockName: '테스트반도체전자',
            range: { lossBp: -1000, gainBp: 1000 },
            scouted: true,
            sentences: [],
            remarks: [],
            options: [],
            ready: true,
            convened: true,
            outcome: null,
          },
          lastSettlement: null,
          weapons: [
            {
              kind: 'pistol',
              name: '권총',
              grade: 'F',
              gradeName: 'F',
              damagePercent: 100,
              fireMs: 260,
              power: 1,
              bulletSpeed: 720,
              equipped: true,
              count: 1,
            },
          ],
          battleUpgrades: [
            { kind: 'damage', bonusPercent: 300 },
            { kind: 'fire', bonusPercent: 200 },
          ],
        },
      }),
    )
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
    await page.getByTestId('settle').waitFor()
    await page.evaluate(async () => {
      const path = '/app/src/app/ui.ts'
      const { useAppUi } = await import(/* @vite-ignore */ path)
      useAppUi.getState().startBattle({ kind: 'invest', mode: 'ASSAULT', level: 1 })
    })
    await page.getByTestId('mental-start').click()
    await expect(page.getByTestId('mental-cards')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.stage-card-description')).toHaveCount(0)
    await expect(page.getByTestId('battle-price-up')).toHaveText('0%')
    await expect(page.locator('.battle-price-name')).toHaveText('테스트반도체전자')
    await page.screenshot({ path: resolve(out, `cards-${width}.png`) })
    let configured = false,
      captured = false,
      gainSeen = false,
      bossSeen = false,
      riseSeen = false
    const appeared = new Set<number>()
    const deadline = Date.now() + 180000
    while (Date.now() < deadline && !(await page.getByTestId('mental-result').count())) {
      if (await page.getByTestId('mental-cards').count()) {
        const cards = page.getByTestId('mental-cards')
        await expect(cards).toHaveAttribute('data-revealed', 'true')
        await cards.getByRole('button').first().click()
        await expect(cards).toHaveCount(0)
        continue
      }
      if (!configured) {
        await page.evaluate(() => {
          const dev = window as unknown as Dev
          dev.__mentalAutopilot(true)
          dev.__mentalSpeed(2)
          dev.__mentalMagic({ water: 1, meteor: 1, lightning: 1, earth: 1 })
        })
        configured = true
      }
      await checkLayout(page)
      if (!captured) {
        await page.screenshot({ path: resolve(out, `battle-${width}.png`) })
        captured = true
      }
      const walls = await page.evaluate(() => (window as unknown as Dev).__mentalWalls())
      for (const wall of walls) {
        assert(!wall.held, 'next wall appears immediately after the collapse transition')
        if (wall.bottom > 0) {
          assert(!wall.held, 'visible wall is hittable')
          appeared.add(wall.index)
        }
      }
      if (!gainSeen && (await page.getByTestId('battle-wall-gain').count())) {
        gainSeen = true
        await page.screenshot({ path: resolve(out, `gain-${width}.png`) })
        await expect(page.getByTestId('battle-wall-gain')).toHaveCount(1)
        await expect(page.getByTestId('battle-wall-gain')).toContainText('주가 상승')
        await expect(page.getByTestId('battle-wall-gain')).toContainText('+10%')
      }
      if (
        !riseSeen &&
        (await page
          .getByTestId('battle-price-up')
          .evaluateAll((els) => els[0]?.textContent ?? null)) === '▲20%'
      ) {
        riseSeen = true
        await page.screenshot({ path: resolve(out, `rise-${width}.png`) })
      }
      if (!bossSeen && (await page.getByTestId('battle-boss').count())) {
        bossSeen = true
        await page.screenshot({ path: resolve(out, `boss-${width}.png`) })
      }
      await page.waitForTimeout(100)
    }
    await expect(page.getByTestId('mental-result')).toBeVisible()
    await page.screenshot({ path: resolve(out, `result-${width}.png`) })
    assert(gainSeen, 'wall gain animation appeared')
    assert(bossSeen, 'boss HUD inspected')
    assert(riseSeen, 'stock price rose from 0% to 20%')
    assert(appeared.size >= 3, 'several walls entered the viewport')
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${width}px: ${appeared.size} walls, gain, boss, cards, result; no overlapping HUD or page errors`,
    )
    await page.evaluate(async () => {
      const path = '/app/src/app/ui.ts'
      const { useAppUi } = await import(/* @vite-ignore */ path)
      useAppUi.getState().endBattle()
    })
    await page.waitForTimeout(200)
    await page.evaluate(async () => {
      const path = '/app/src/app/ui.ts'
      const { useAppUi } = await import(/* @vite-ignore */ path)
      useAppUi.getState().startBattle({ kind: 'invest', mode: 'DEFENSE', level: 1 })
    })
    await page.getByTestId('mental-start').click()
    await expect(page.getByTestId('mental-cards')).toBeVisible()
    await expect(page.getByTestId('mental-cards')).toHaveAttribute('data-revealed', 'true')
    await page.getByTestId('mental-cards').getByRole('button').first().click()
    await expect(page.getByTestId('mental-cards')).toHaveCount(0)
    await expect(page.locator('.battle-hud-assault')).toHaveCount(0)
    await expect(page.getByTestId('battle-hud')).toBeVisible()
    await page.screenshot({ path: resolve(out, `defense-${width}.png`) })
    assert.deepEqual(errors, [])
    await page.close()
  }
} finally {
  await browser.close()
}
