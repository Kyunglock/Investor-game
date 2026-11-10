/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' })
mkdirSync('scripts/shots/invest-resume', { recursive: true })
try {
  for (const width of [320, 390])
    for (const [choice, up, mode] of [
      ['BUY', true, 'ASSAULT'],
      ['SELL', false, 'ASSAULT'],
      ['BUY', false, 'DEFENSE'],
      ['SELL', true, 'DEFENSE'],
    ] as const) {
      const battle = {
        mode,
        level: 1,
        levelParts: [],
        open: true,
        stars: null as number | null,
        bonus: null as number | null,
        before: 1000000,
        after: null as number | null,
      }
      const outcome = {
        choice,
        big: false,
        delegated: false,
        teamBuy: 0,
        teamSell: 0,
        debate: [],
        up,
        reveal: '실적이 올랐다',
        decisive: 0,
        total: 1000000,
        returnBp: 1000,
        gainBp: 1000,
        lossBp: -1000,
        battle,
        results: [],
        reactions: [],
      }
      const invest = {
        title: '신제품 출시',
        sector: 'semiconductor',
        sectorName: '반도체',
        stockName: '테스트전자',
        range: { lossBp: -1000, gainBp: 1000 },
        scouted: true,
        sentences: [{ text: '실적이 올랐다', highlighted: false }],
        sway: { who: '동료', text: '좋아 보여요' },
        remarks: [],
        options: [
          { code: 'BUY', label: '산다' },
          { code: 'SELL', label: '판다' },
        ],
        ready: true,
        convened: true,
        outcome: null as typeof outcome | null,
      }
      const company = { ...fixture, invest, lastSettlement: null }
      let settlements = 0,
        reports = 0,
        decisions = 0
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        reducedMotion: process.env.NORMAL_MOTION ? 'no-preference' : 'reduce',
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
      })
      const errors: string[] = []
      page.setDefaultTimeout(15000)
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      await page.addInitScript(() => {
        const violations: string[] = []
        ;(window as unknown as { progressViolations: string[] }).progressViolations = violations
        new MutationObserver(() => {
          const actions = document.querySelectorAll('.toy-bottom-cards .toy-progress')
          if (actions.length > 1) violations.push('multiple primary actions')
          for (const action of actions) {
            const text = action.textContent ?? ''
            const battle = /매도벽 돌파|멘탈 방어/.test(text)
            const quarter = /다음 분기로|넘기기|첫 게임 시작/.test(text)
            if (battle && quarter) violations.push('mixed battle and quarter labels')
          }
        }).observe(document, { childList: true, subtree: true, characterData: true })
      })
      const checkTransitions = async () => {
        assert.deepEqual(
          await page.evaluate(
            () => (window as unknown as { progressViolations: string[] }).progressViolations,
          ),
          [],
          'no overlapping actions during state transitions',
        )
      }
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
        const path = new URL(route.request().url()).pathname
        if (route.request().method() === 'POST') {
          if (path.endsWith('/invest')) {
            invest.outcome = outcome
            invest.ready = false
            decisions++
          }
          if (path.endsWith('/settle')) settlements++
          if (path.endsWith('/invest/battle')) {
            battle.open = false
            battle.stars = 0
            battle.bonus = 0
            battle.after = battle.before
            reports++
          }
        }
        return route.fulfill({ json: company })
      })
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5190/app/')
      const primary = await page.getByTestId('settle').elementHandle()
      await page.getByTestId('settle').click()
      await page.getByTestId('invest-to-decide').click()
      await page.locator(`[data-choice="${choice}"]`).click()
      await expect(page.getByTestId('invest-battle')).toBeVisible({ timeout: 30000 })
      await page.getByTestId('invest-battle').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `scripts/shots/invest-resume/result-${mode}-${width}.png` })
      await page.getByTestId('invest-leave').click()
      await expect(page.getByTestId('invest')).toHaveCount(0)
      await expect(page.getByTestId('pending-invest-battle')).toContainText(
        mode === 'ASSAULT' ? '매도벽 돌파!' : '멘탈 방어!',
      )
      await expect(page.getByTestId('settle')).toHaveCount(0)
      assert.ok(await primary?.evaluate((el) => !el.isConnected), 'old quarter button is removed')
      await expect(page.locator('.toy-progress')).toHaveCount(1)
      await expect(page.locator('.toy-progress')).toHaveAttribute('data-progress', mode)
      await expect(page.locator('.toy-progress')).not.toContainText('다음 분기로')
      await expect(page.locator('.toy-progress')).not.toContainText('넘기기')
      await expect(page.locator('.toy-progress svg')).toHaveCount(0)
      const copy = page.locator('.toy-progress .battle-entry-copy')
      const subtitle = await copy.locator('small').boundingBox()
      const title = await copy.locator('strong').boundingBox()
      assert(subtitle && title && subtitle.y + subtitle.height + 7 <= title.y)
      await expect(page.locator('.toy-bottom-cards > button')).toHaveCount(3)
      const boxes = await page.locator('.toy-bottom-cards > button').evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { left: r.left, right: r.right }
        }),
      )
      assert.ok(boxes[0].right <= boxes[1].left && boxes[1].right <= boxes[2].left)
      await page.getByTestId('pending-invest-battle').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `scripts/shots/invest-resume/home-${mode}-${width}.png` })
      await checkTransitions()
      await page.reload()
      await expect(page.getByTestId('pending-invest-battle')).toBeVisible()
      await page.getByTestId('tab-staff').click()
      await expect(page.getByTestId('pending-invest-battle')).toBeVisible()
      await page.getByTestId('pending-invest-battle').click()
      await expect(page.getByTestId('mental-lobby')).toBeVisible()
      if (mode === 'ASSAULT')
        await expect(page.getByTestId('mental-lobby')).toContainText('매도벽 돌파!')
      assert.equal(settlements, 0)
      assert.equal(decisions, 1)
      // 시작 전 나가도 결과를 잃지 않고 다시 진입할 수 있다.
      await page.getByTestId('mental-skip').click()
      await page.getByTestId('invest-leave').click()
      await page.getByTestId('pending-invest-battle').click()
      await page.getByTestId('mental-start').click()
      await expect(page.getByTestId('mental-cards')).toBeVisible()
      for (let i = 0; i < 10 && (await page.getByTestId('mental-cards').count()); i++) {
        const card = page.getByTestId('mental-cards').locator('button:not(:disabled)').first()
        if (await card.count()) await card.click()
        await page.waitForTimeout(300)
      }
      await expect(page.getByTestId('mental-cards')).toHaveCount(0)
      const gauge = await page.getByTestId('battle-wall').boundingBox()
      const footer = await page.getByTestId('battle-footer').boundingBox()
      const height = page.viewportSize()?.height ?? 0
      assert(gauge && footer)
      assert(gauge.y > height - 80 && gauge.y + gauge.height <= height - 10)
      assert(gauge.x >= 0 && gauge.x + gauge.width <= width)
      const badges = await page.locator('.battle-cards').boundingBox()
      if (badges) assert(badges.y + badges.height <= gauge.y)
      await expect(page.getByTestId('battle-footer')).not.toContainText('발사')
      await page.screenshot({ path: `scripts/shots/invest-resume/health-${mode}-${width}.png` })
      await page.getByTestId('mental-quit').click()
      await page.getByTestId('mental-quit-yes').click()
      await page.getByTestId('invest-leave').click()
      assert.equal(reports, 0)
      await page.getByTestId('pending-invest-battle').click()
      await page.getByTestId('mental-start').click()
      await expect(page.getByTestId('mental-cards')).toBeVisible()
      await page.evaluate(() =>
        (window as unknown as { __mentalSpeed: (k: number) => void }).__mentalSpeed(50),
      )
      const deadline = Date.now() + 60000
      while (Date.now() < deadline && !(await page.getByTestId('mental-done').count())) {
        if (await page.getByTestId('mental-cards').count()) {
          const card = page.getByTestId('mental-cards').locator('button:not(:disabled)').first()
          if (await card.count()) await card.click()
        }
        await page.waitForTimeout(200)
      }
      assert.deepEqual(errors, [], 'battle runtime errors')
      await page.screenshot({ path: `scripts/shots/invest-resume/result-${mode}-${width}.png` })
      await page.getByTestId('mental-done').click()
      await expect(page.getByTestId('invest-battle-summary')).toBeVisible()
      await page.getByTestId('invest-leave').click()
      await expect(page.getByTestId('pending-invest-battle')).toHaveCount(0)
      await expect(page.locator('.toy-progress')).toHaveAttribute('data-progress', 'QUARTER')
      await expect(page.locator('.toy-progress')).not.toContainText('매도벽 돌파')
      await expect(page.locator('.toy-progress')).not.toContainText('멘탈 방어')
      await checkTransitions()
      await page.getByTestId('settle').click()
      await expect.poll(() => settlements).toBe(1)
      assert.equal(reports, 1)
      assert.deepEqual(errors, [])
      console.log(
        `PASS ${choice}/${up ? 'UP' : 'DOWN'} ${mode} ${width}: leave, reload, other tab, resume, report once, restore next quarter`,
      )
      await page.close()
    }
} finally {
  await browser.close()
}
