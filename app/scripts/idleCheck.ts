import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of process.env.UI_WIDTH ? [Number(process.env.UI_WIDTH)] : [320, 390, 1024]) {
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
    await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/')
    await expect(page.getByTestId('idle-battle'))
      .toBeVisible()
      .catch(async (e) => {
        console.log(errors, await page.locator('body').textContent())
        throw e
      })
    await expect(page.getByText('● AUTO')).toBeVisible()
    await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible()
    await page.evaluate(() => {
      ;(window as unknown as { idleCanvas: Element | null }).idleCanvas = document.querySelector(
        '[data-testid=idle-canvas] canvas',
      )
    })
    await expect.poll(() => actions.filter((a) => a === 'tick').length).toBeGreaterThan(0)
    assert.equal(await page.locator('.idle-skills, .idle-upgrades').count(), 0)
    await page.getByRole('button', { name: '성장' }).click()
    await expect(page.getByTestId('idle-menu')).toBeVisible()
    await expect(page.getByText('초당 공격력')).toBeVisible()
    await page.getByRole('tab', { name: '스킬', exact: true }).click()
    await expect(page.getByText('5벽 돌파 시 획득', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    assert.equal(
      await page.evaluate(
        () =>
          (window as unknown as { idleCanvas: Element }).idleCanvas ===
          document.querySelector('[data-testid=idle-canvas] canvas'),
      ),
      true,
    )
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
    await expect.poll(() => actions.slice(stopped).includes('start')).toBe(true)
    company.idle.wall = 6
    company.idle.skills[0].owned = true
    company.idle.nextUnlock = 15
    await expect(page.locator('.idle-stage strong')).toHaveText('매도벽 6')
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => (window as unknown as { __mentalWalls: () => unknown[] }).__mentalWalls().length,
          ),
        { timeout: 10000 },
      )
      .toBe(1)
    const walls = await page.evaluate(() =>
      (window as unknown as { __mentalWalls: () => { hp: number }[] }).__mentalWalls(),
    )
    assert.equal(walls.length, 1)
    assert(walls[0].hp > 0)
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              (
                window as unknown as { __mentalWalls: () => { arrived: boolean }[] }
              ).__mentalWalls()[0]?.arrived,
          ),
        { timeout: 15000 },
      )
      .toBe(true)
    await page.screenshot({ path: `/tmp/idle-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '성장' }).click()
    await page.getByRole('tab', { name: '능력치', exact: true }).click()
    await page.screenshot({ path: `/tmp/idle-growth-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    if (width === 390) {
      await page.evaluate(() =>
        (window as unknown as { __mentalSpeed: (n: number) => void }).__mentalSpeed(20),
      )
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                (
                  window as unknown as { __mentalMarket: () => { battleSeconds: number } }
                ).__mentalMarket().battleSeconds,
            ),
          { timeout: 30000 },
        )
        .toBeGreaterThan(185)
      assert.equal(await page.getByTestId('mental-result').count(), 0)
      await page.evaluate(() =>
        (window as unknown as { __mentalSpeed: (n: number) => void }).__mentalSpeed(1),
      )
      company.idle.wall = 10
      company.idle.boss = true
      await expect(page.locator('.idle-stage strong')).toHaveText('매도벽 10')
      await page.waitForTimeout(1500)
      company.idle.wall = 11
      company.idle.boss = false
      await expect(page.locator('.idle-stage strong')).toHaveText('매도벽 11')
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                (window as unknown as { __mentalWalls: () => unknown[] }).__mentalWalls().length,
            ),
          { timeout: 10000 },
        )
        .toBe(1)
    }
    await page.getByRole('button', { name: '회사', exact: true }).click()
    await expect(page.getByTestId('office-scene')).toBeVisible()
    const nav = page.getByRole('navigation', { name: '게임 메뉴' }).last()
    await expect(nav.getByRole('button')).toHaveCount(5)
    await expect(nav.getByRole('button', { name: '회사', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const name of ['성장', '고양이', '소환']) {
      await nav.getByRole('button', { name }).click()
      await expect(page.getByTestId('idle-menu')).toBeVisible()
      await expect(nav.getByRole('button', { name })).toHaveAttribute('aria-current', 'page')
      await page.getByRole('button', { name: '닫기 ✕' }).click()
      await expect(page.getByTestId('office-scene')).toBeVisible()
      await expect(nav.getByRole('button', { name: '회사', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
    // A short viewport must scroll office controls above the fixed navigation.
    await page.setViewportSize({ width, height: 640 })
    await page.locator('.idle-office').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    const office = await page.getByTestId('office-scene').boundingBox()
    const tabs = await nav.boundingBox()
    assert.ok(office && tabs && office.y + office.height <= tabs.y + 1)
    await page.screenshot({ path: `/tmp/idle-office-${width}.png`, fullPage: true })
    await nav.getByRole('button', { name: '돌파', exact: true }).click()
    await expect(page.getByTestId('office-scene')).toHaveCount(0)
    await expect(page.locator('.idle-stage')).toBeVisible()
    assert.equal(
      await page.evaluate(
        () =>
          (window as unknown as { idleCanvas: Element }).idleCanvas ===
          document.querySelector('[data-testid=idle-canvas] canvas'),
      ),
      true,
    )
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
