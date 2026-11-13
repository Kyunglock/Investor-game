import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390, 1024]) {
    const company = {
      ...structuredClone(fixture),
      battleUpgrades: [
        {
          kind: 'damage',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
        },
        {
          kind: 'fire',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
        },
      ],
      idle: {
        wall: 1,
        hp: 120,
        maxHp: 120,
        dps: 12,
        earned: 0,
        boss: false,
        nextUnlock: 5,
        skills: [
          { code: 'water', name: '물 스킬', unlockWall: 5, owned: false },
          { code: 'meteor', name: '메테오 고양이', unlockWall: 15, owned: false },
          { code: 'bolt', name: '번개 스킬', unlockWall: 30, owned: false },
          { code: 'ram', name: '충차 고양이', unlockWall: 50, owned: false },
        ],
      },
    }
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    })
    const errors: string[] = []
    const actions: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      if (route.request().url().endsWith('/idle')) {
        const body = route.request().postDataJSON()
        actions.push(body.action)
        if (body.action === 'tick') company.idle.hp = Math.max(1, company.idle.hp - 12)
      }
      await route.fulfill({ json: company })
    })
    await page.goto('http://localhost:5173/app/')
    await expect(page.getByTestId('idle-battle'))
      .toBeVisible()
      .catch(async (e) => {
        console.log(errors, await page.locator('body').textContent())
        throw e
      })
    await expect(page.getByText('● 자동 전투 중')).toBeVisible()
    await expect.poll(() => actions.filter((a) => a === 'tick').length).toBeGreaterThan(0)
    assert.equal(await page.locator('.idle-spell').count(), 0)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
    )
    await expect.poll(() => actions.at(-1)).toBe('stop')
    const stopped = actions.length
    await page.waitForTimeout(2200)
    assert.equal(actions.length, stopped)
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: true })),
    )
    await expect.poll(() => actions.at(-1)).toBe('start')
    company.idle.wall = 6
    company.idle.skills[0].owned = true
    company.idle.nextUnlock = 15
    await expect(page.locator('.idle-water')).toBeAttached()
    await page.screenshot({ path: `/tmp/idle-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '회사 관리 ↗' }).click()
    await expect(page.getByTestId('office-scene')).toBeVisible()
    await page.getByRole('button', { name: '← 자동 매도벽 돌파' }).click()
    await expect(page.getByTestId('idle-battle')).toBeVisible()
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log(
    'PASS: main view, heartbeat, background stop/resume, skill gating, management, 320/390/1024px',
  )
} finally {
  await browser.close()
}
