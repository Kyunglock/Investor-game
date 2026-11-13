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
        circuitSeconds: 0,
        upcoming: [] as { wall: number; hp: number; maxHp: number }[],
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
      reducedMotion: width === 390 ? 'no-preference' : 'reduce',
    })
    const errors: string[] = []
    const loadingErrors: string[] = []
    const actions: string[] = []
    const reportedHits: { wall: number; kind: string; count: number }[] = []
    let circuitJustStarted = false
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (message) => {
      if (message.type() === 'error') loadingErrors.push(message.text())
    })
    page.on('requestfailed', (request) =>
      loadingErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
    )
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      if (route.request().url().endsWith('/idle')) {
        const body = route.request().postDataJSON()
        actions.push(body.action)
        reportedHits.push(...(body.hits ?? []))
        if (body.action === 'tick' && circuitJustStarted) {
          circuitJustStarted = false
        } else if (body.action === 'tick') {
          if (company.idle.circuitSeconds > 0)
            company.idle.circuitSeconds = Math.max(0, company.idle.circuitSeconds - 2)
          else {
            const hits = (body.hits ?? []).filter(
              (hit: { wall: number }) => hit.wall === company.idle.wall,
            )
            company.idle.hp = Math.max(
              1,
              company.idle.hp -
                hits.reduce((total: number, hit: { count: number }) => total + hit.count * 12, 0),
            )
          }
        }
      }
      await route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/')
    // A cold Vite server may still be compiling modules after its HTML responds.
    await expect(page.getByTestId('idle-battle'))
      .toBeVisible({ timeout: 30000 })
      .catch(async (e) => {
        console.log({
          width,
          errors,
          loadingErrors,
          body: await page.locator('body').textContent(),
        })
        await page.screenshot({ path: `/tmp/idle-failure-${width}.png` }).catch(() => {})
        throw e
      })
    await expect(page.getByText('● AUTO')).toBeVisible()
    await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => {
      ;(window as unknown as { idleCanvas: Element | null }).idleCanvas = document.querySelector(
        '[data-testid=idle-canvas] canvas',
      )
    })
    await expect.poll(() => actions.filter((a) => a === 'tick').length).toBeGreaterThan(0)
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('idle-wall-hit', { detail: { wall: 1, kind: 'bullet' } }),
      ),
    )
    await expect
      .poll(() =>
        reportedHits.some((hit) => hit.wall === 1 && hit.kind === 'bullet' && hit.count > 0),
      )
      .toBe(true)
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
    await expect(page.getByTestId('idle-wall-number')).toHaveText('매도벽 6')
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
    const market = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            __mentalMarket: () => {
              battleSeconds: number
              simSpeed: number
              physicsPaused: boolean
              running: boolean
              catTextures: string[]
              circuits: number
              circuit: null | { elapsed: number; queuedSell: number; queuedBuy: number }
            }
          }
        ).__mentalMarket(),
      )
    assert.equal((await market()).simSpeed, 1) // Existing 2x speed uses simScale(2) = 1.
    company.idle.circuitSeconds = 4
    circuitJustStarted = true
    await expect.poll(async () => (await market()).circuit !== null).toBe(true)
    await expect(page.getByText('거래 정지', { exact: true })).toBeVisible()
    await expect.poll(async () => (await market()).circuit?.queuedSell ?? 0).toBeGreaterThan(0)
    assert.equal((await market()).physicsPaused, true)
    await expect.poll(async () => (await market()).circuit?.queuedBuy ?? 0).toBeGreaterThan(0)
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
    )
    await expect.poll(() => actions.at(-1)).toBe('stop')
    const circuitClock = (await market()).battleSeconds
    const pausedCircuit = (await market()).circuit?.elapsed
    assert.notEqual(pausedCircuit, undefined)
    await page.screenshot({ path: `/tmp/idle-circuit-${width}.png`, fullPage: true })
    const frozenRemaining = company.idle.circuitSeconds
    await page.waitForTimeout(800)
    assert.equal((await market()).circuit?.elapsed, pausedCircuit)
    assert.equal(company.idle.circuitSeconds, frozenRemaining)
    assert.equal((await market()).battleSeconds, circuitClock)
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: true })),
    )
    await expect.poll(async () => (await market()).circuit, { timeout: 10000 }).toBe(null)
    await expect.poll(async () => (await market()).physicsPaused).toBe(false)
    await expect.poll(async () => (await market()).battleSeconds).toBeGreaterThan(circuitClock)
    if (width === 390) {
      // Acquired companions run too; observe multiple animation frames without moving hitboxes.
      company.idle.skills[1].owned = true
      await expect.poll(async () => (await market()).catTextures.length).toBeGreaterThan(1)
      const frames = new Set<string>()
      for (let i = 0; i < 8; i++) {
        frames.add((await market()).catTextures.join(','))
        await page.waitForTimeout(80)
      }
      assert(frames.size >= 3)
      assert((await market()).catTextures.every((key) => key.includes('-run-')))
    } else {
      assert((await market()).catTextures.every((key) => !key.includes('-run-')))
    }
    const queuedWalls = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __mentalWalls: () => {
                upcoming: {
                  wall: number
                  hp: number
                  crack: string
                  top: number
                  bottom: number
                  visible: boolean
                  boss: boolean
                }[]
              }[]
            }
          ).__mentalWalls()[0]?.upcoming ?? [],
      )
    await expect.poll(async () => (await queuedWalls()).map((wall) => wall.wall)).toEqual([7, 8])
    const intact = (await queuedWalls())[0].crack
    company.idle.upcoming = [
      { wall: 7, hp: 30, maxHp: 264 },
      { wall: 8, hp: 100, maxHp: 288 },
    ]
    await expect.poll(async () => (await queuedWalls())[0].hp).toBe(30)
    assert.notEqual((await queuedWalls())[0].crack, intact)
    const cash = await page.locator('.idle-cash').first().boundingBox()
    const number = await page.getByTestId('idle-wall-number').boundingBox()
    assert(cash && number && cash.x + cash.width <= number.x)
    const queue = await queuedWalls()
    assert(queue.every((wall) => wall.visible && wall.top >= 85))
    assert(queue[1].bottom < queue[0].top)
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
      company.idle.wall = 8
      await expect.poll(async () => (await queuedWalls()).map((wall) => wall.wall)).toEqual([9, 10])
      assert.equal((await queuedWalls())[1].boss, true)
      company.idle.wall = 10
      company.idle.boss = true
      await expect(page.getByTestId('idle-wall-number')).toHaveText('매도벽 10')
      await expect
        .poll(async () => (await queuedWalls()).map((wall) => wall.wall))
        .toEqual([11, 12])
      company.idle.wall = 11
      company.idle.boss = false
      await expect(page.getByTestId('idle-wall-number')).toHaveText('매도벽 11')
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
    if (width === 390) {
      company.idle.wall = 16
      company.idle.circuitSeconds = 4
      circuitJustStarted = true
      await expect.poll(async () => (await market()).circuits).toBe(2)
      // A fast server can reach another halt before the previous client animation finishes.
      company.idle.wall = 26
      company.idle.circuitSeconds = 4
      circuitJustStarted = true
      await expect.poll(async () => (await market()).circuits).toBe(3)
      await expect.poll(async () => (await market()).circuit?.queuedSell ?? 0).toBeGreaterThan(0)
      await expect.poll(async () => (await market()).circuit, { timeout: 10000 }).toBe(null)
    }
    await expect
      .poll(async () => (await queuedWalls()).map((wall) => wall.wall))
      .toEqual([company.idle.wall + 1, company.idle.wall + 2])
    await page.getByRole('button', { name: '회사', exact: true }).click()
    await expect(page.getByTestId('office-scene')).toBeVisible()
    await expect(page.getByTestId('office-support')).toContainText('자동 전투 중')
    await expect(page.getByTestId('office-support')).toContainText(`${company.idle.wall}벽`)
    await expect(page.getByTestId('assault-open')).toHaveCount(0)
    await expect(page.getByTestId('side-open')).toHaveCount(0)
    await expect(page.getByTestId('battle-upgrade-open')).toHaveCount(0)
    const officeTicks = actions.filter((action) => action === 'tick').length
    await expect
      .poll(() => actions.filter((action) => action === 'tick').length)
      .toBeGreaterThan(officeTicks)
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
    await expect
      .poll(async () => {
        const queue = await queuedWalls()
        return queue.length === 2 && queue.every((wall) => wall.top >= 85)
      })
      .toBe(true)
    await page.screenshot({ path: `/tmp/idle-stack-short-${width}.png`, fullPage: true })
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
