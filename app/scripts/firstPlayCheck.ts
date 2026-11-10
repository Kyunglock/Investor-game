/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' })
mkdirSync('scripts/shots/first-play', { recursive: true })
try {
  for (const width of [320, 390]) {
    const choice = 'BUY',
      up = true,
      mode = 'ASSAULT'
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
      scouted: false,
      sentences: [{ text: '실적이 올랐다', highlighted: false }],
      sway: { who: '동료', text: '좋아 보여요' },
      remarks: [],
      options: [
        { code: 'BUY', label: '산다' },
        { code: 'SELL', label: '판다' },
      ],
      ready: false,
      convened: false,
      outcome: null as typeof outcome | null,
    }
    const company = {
      ...structuredClone(fixture),
      year: 1,
      quarter: 1,
      invest,
      lastSettlement: null,
      lastQuarter: null,
    }
    company.employees = []
    company.gacha.draws = 0
    company.gacha.drawn = []
    let exists = false,
      draws = 0,
      placements = 0,
      opens = 0,
      scouts = 0
    let failPlacement = width === 320
    let settlements = 0,
      reports = 0,
      decisions = 0
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() === 'GET' && !exists)
        return route.fulfill({ status: 404, json: {} })
      if (route.request().method() === 'POST') {
        if (path === '/api/company') exists = true
        if (path.endsWith('/draws')) {
          draws++
          company.employees = [{ ...structuredClone(fixture.employees[0]), desk: null }]
          company.gacha.draws++
          company.gacha.tickets--
        }
        if (path.endsWith('/placement')) {
          if (failPlacement) {
            failPlacement = false
            return route.fulfill({ status: 503, json: { message: '배치 재시도 검사' } })
          }
          placements++
          const seats = route.request().postDataJSON().seats as {
            employeeId: number
            desk: string | null
          }[]
          for (const e of company.employees)
            e.desk = seats.find((s) => s.employeeId === e.id)?.desk ?? null
        }
        if (path.endsWith('/scout')) {
          scouts++
          invest.scouted = true
          invest.ready = true
        }
        if (path.endsWith('/invest/open')) {
          opens++
          invest.convened = true
        }
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
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5196/app/')
    await expect(page.getByTestId('office-scene')).toBeVisible()
    const guide = page.getByTestId('tutorial-guide')
    await expect(guide).toBeVisible()
    if (width === 320) {
      await expect(guide.getByRole('alert')).toBeVisible()
      await page.getByTestId('tutorial-next').click()
    }
    await expect(page.getByTestId('tutorial-next')).toBeEnabled()
    await expect(guide).toContainText('첫 출근')
    await page.waitForTimeout(6500)
    await expect(guide).toContainText('첫 출근')
    assert.equal(opens, 0)
    assert.equal(decisions, 0)
    assert.equal(settlements, 0)
    assert.equal(draws, 1)
    assert.equal(placements, 1)
    assert.equal(scouts, 1)
    await expect(page.getByTestId('shell')).toHaveAttribute('inert', '')
    await page.screenshot({ path: `scripts/shots/first-play/welcome-${width}.png` })
    await page.getByTestId('tutorial-next').click()
    await expect(guide).toContainText('첫 판 준비는 끝났어요')
    await page.reload()
    await expect(guide).toContainText('첫 판 준비는 끝났어요')
    await expect(page.getByTestId('tutorial-next')).toBeEnabled()
    assert.equal(draws, 1)
    assert.equal(placements, 1)
    await page.getByTestId('tutorial-next').click()
    await expect(guide).toContainText('이제 사장님의 선택')
    await page.getByTestId('tutorial-next').click()
    await expect(guide).toHaveCount(0)
    await expect(page.getByTestId('invest')).toBeVisible()
    assert.equal(opens, 1)
    await page.getByTestId('invest-to-decide').click()
    await page.locator(`[data-choice="${choice}"]`).click()
    await expect(page.getByTestId('invest-battle')).toBeVisible()
    await page.getByTestId('invest-battle').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `scripts/shots/first-play/result-${mode}-${width}.png` })
    await page.getByTestId('invest-leave').click()
    await expect(page.getByTestId('invest')).toHaveCount(0)
    await expect(page.getByTestId('pending-invest-battle')).toContainText(
      mode === 'ASSAULT' ? '매도벽 돌파!' : '멘탈 방어!',
    )
    await expect(page.getByTestId('settle')).toHaveCount(0)
    await expect(page.locator('.toy-bottom-cards > button')).toHaveCount(3)
    const boxes = await page.locator('.toy-bottom-cards > button').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right }
      }),
    )
    assert.ok(boxes[0].right <= boxes[1].left && boxes[1].right <= boxes[2].left)
    await page.getByTestId('pending-invest-battle').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `scripts/shots/first-play/home-${mode}-${width}.png` })
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
    await expect(page.getByTestId('card-manual')).toBeVisible()
    await page.waitForTimeout(6500)
    await expect(page.getByTestId('mental-cards')).toBeVisible()
    await expect(page.getByTestId('card-auto')).toHaveCount(0)
    for (let i = 0; i < 3 && (await page.getByTestId('mental-cards').count()); i++) {
      await page.getByTestId('mental-cards').getByRole('button').first().click()
      await page.waitForTimeout(300)
    }
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
    const deadline = Date.now() + 30000
    while (Date.now() < deadline && !(await page.getByTestId('mental-done').count())) {
      if (await page.getByTestId('mental-cards').count()) {
        await page.getByTestId('mental-cards').getByRole('button').first().click()
      }
      await page.waitForTimeout(200)
    }
    await page.getByTestId('mental-done').click()
    await expect(page.getByTestId('tutorial-guide')).toContainText('첫 게임, 해냈어요!')
    await page.getByTestId('tutorial-next').click()
    await expect(page.getByTestId('tutorial-guide')).toHaveCount(0)
    await expect(page.getByTestId('invest-battle-summary')).toBeVisible()
    await page.getByTestId('invest-leave').click()
    await expect(page.getByTestId('pending-invest-battle')).toHaveCount(0)
    await page.getByTestId('settle').click()
    await expect.poll(() => settlements).toBe(1)
    assert.equal(reports, 1)
    assert.deepEqual(errors, [])
    console.log(
      `PASS first-play ${width}: prepare once, retry, manual guide, reload, manual cards, battle, finish`,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
