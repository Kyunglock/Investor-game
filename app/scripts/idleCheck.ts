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
      armory: { tickets: 6, mergeCount: 2, lastDraw: null },
      battleUpgrades: [
        {
          kind: 'damage',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'fire',
          level: 100,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 100,
          nextBonusPercent: 100,
          maxLevel: 100,
        },
        {
          kind: 'hp',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'buy',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'crit',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 20,
          maxLevel: 0,
        },
      ],
      idle: {
        wall: 1,
        hp: 120,
        maxHp: 120,
        dps: 12,
        earned: 0,
        boss: false,
        circuitSeconds: 0,
        upcoming: [] as { wall: number; hp: number; maxHp: number }[],
        skills: [
          { code: 'water', name: '물 스킬', owned: false, level: 0 },
          { code: 'meteor', name: '메테오 스킬', owned: false, level: 0 },
          { code: 'bolt', name: '번개 스킬', owned: false, level: 0 },
          { code: 'ram', name: '충차 스킬', owned: false, level: 0 },
        ],
        fieldSlots: 4,
        wallDps: 0,
        cats: [
          // Each cat has a skill of its own (decisions.md 501).
          ['sky', '하늘냥', 125, 100, 'meteor', '메테오 스킬'],
          ['mint', '민트냥', 100, 100, 'water', '물 스킬'],
          ['lilac', '라일락냥', 100, 150, 'bolt', '번개 스킬'],
          ['sunset', '노을냥', 110, 100, 'ram', '충차 스킬'],
          ['night', '밤냥', 100, 125, 'meteor', '메테오 스킬'],
          ['snow', '눈꽃냥', 140, 100, 'water', '물 스킬'],
        ].map(([code, name, firePercent, criticalPercent, skill, skillName]) => ({
          code,
          name,
          level: 0,
          damagePercent: 50,
          firePercent,
          criticalPercent,
          fielded: false,
          skill,
          skillName,
          // A skill gains a level with every two cat levels (decisions.md 515).
          skillLevel: 1,
          skillNextLevel: 3,
          weapon: null as { kind: string; grade: string } | null,
        })),
      },
    }
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: width === 390 ? 'no-preference' : 'reduce',
    })
    const errors: string[] = []
    const loadingErrors: string[] = []
    const actions: string[] = []
    const reportedHits: { wall: number; kind: string; count: number; damage: number }[] = []
    let circuitJustStarted = false
    let catDraws = 0
    const hires: number[] = []
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
                hits.reduce((total: number, hit: { damage: number }) => total + hit.damage, 0),
            )
          }
        }
      }
      // Cat gacha, fielding and equipment (decisions.md 488): the mock keeps the server's shape.
      const path = new URL(route.request().url()).pathname
      const sent = route.request().postDataJSON()
      const cat = company.idle.cats.find((c) => c.code === sent?.code)
      if (path.endsWith('/draws')) hires.push(sent.count)
      if (path.endsWith('/cat/draw')) {
        const drawn = company.idle.cats[catDraws++ % 6]
        company.armory.tickets--
        drawn.level++
        drawn.damagePercent = 50 + (drawn.level - 1) * 10
        if (drawn.level === 1 && company.idle.cats.filter((c) => c.fielded).length < 4)
          drawn.fielded = true
      } else if (path.endsWith('/cat/field') && cat) {
        cat.fielded = sent.fielded
      } else if (path.endsWith('/cat/weapon') && cat) {
        cat.weapon = sent.kind ? { kind: sent.kind, grade: sent.grade } : null
      }
      for (const skill of company.idle.skills) {
        skill.owned = company.idle.cats.some((c) => c.fielded && c.skill === skill.code)
        skill.level = skill.owned ? 1 : 0
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
    // No status line (decisions.md 493): the HUD shows only the wall number while fighting.
    await expect(page.getByTestId('idle-wall-number')).toHaveAttribute('data-state', 'auto')
    await expect(page.locator('.idle-stage')).toHaveCount(0)
    await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => {
      ;(window as unknown as { idleCanvas: Element | null }).idleCanvas = document.querySelector(
        '[data-testid=idle-canvas] canvas',
      )
    })
    await expect.poll(() => actions.filter((a) => a === 'tick').length).toBeGreaterThan(0)
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('idle-wall-hit', { detail: { wall: 1, kind: 'bullet', damage: 1 } }),
      ),
    )
    await expect
      .poll(() =>
        reportedHits.some(
          (hit) => hit.wall === 1 && hit.kind === 'bullet' && hit.count > 0 && hit.damage > 0,
        ),
      )
      .toBe(true)
    assert.equal(await page.locator('.idle-skills, .idle-upgrades').count(), 0)
    await page.getByRole('button', { name: '성장' }).click()
    await expect(page.getByTestId('idle-menu')).toBeVisible()
    await expect(page.getByText('모든 공격이 벽에 맞을 때')).toBeVisible()
    await expect(page.getByTestId('idle-wall-dps')).toContainText('실제 벽 피해')
    // Four stats (decisions.md 487): fire speed stops at its cap, the others can be bought.
    await expect(page.getByTestId('idle-stat')).toHaveCount(5)
    const stat = (kind: string) => page.locator(`[data-testid=idle-stat][data-kind=${kind}]`)
    await expect(stat('fire')).toContainText('공격 속도')
    await expect(stat('fire')).toContainText('+100% · 최대')
    await expect(stat('fire').getByRole('button')).toBeDisabled()
    await expect(stat('fire').getByRole('button')).toHaveText('MAX')
    await expect(stat('hp')).toContainText('매수벽 체력')
    await expect(stat('buy')).toContainText('매수벽 공격')
    await expect(stat('crit')).toContainText('치명타 피해')
    await expect(stat('crit')).toContainText('+0% → +20%')
    await page.screenshot({ path: `/tmp/idle-growth-${width}.png`, fullPage: true })
    await page.getByRole('tab', { name: '스킬', exact: true }).click()
    // A skill is a cat's own ability, cast while that cat is fielded (decisions.md 501).
    await expect(page.getByText('메테오 스킬')).toBeVisible()
    await expect(
      page.getByText('하늘냥·밤냥의 고유 스킬 · 출전하면 발동', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('노을냥의 고유 스킬 · 출전하면 발동', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    // Cats are drawn with tickets, fielded in four slots, and kept in a 6 x 3 grid (488, 493, 495).
    await page.getByRole('button', { name: '고양이' }).click()
    await expect(page.locator('.idle-cat-grid > li')).toHaveCount(18)
    await expect(page.getByTestId('cat')).toHaveCount(6)
    await expect(page.getByTestId('cat-slot')).toHaveCount(4)
    await expect(page.getByTestId('cat-field')).toHaveCount(0)
    const tickets = company.armory.tickets
    // The draw opens the same reveal as the weapon draw (decisions.md 508).
    const drawCat = async () => {
      await page.getByTestId('cat-draw').click()
      await expect(page.getByTestId('cat-drawn')).toBeVisible()
      await page.getByTestId('cat-reveal-close').click()
      await expect(page.getByTestId('cat-reveal')).toHaveCount(0)
    }
    await page.getByTestId('cat-draw').click()
    await expect(page.getByTestId('cat-drawn')).toHaveAttribute('data-code', 'sky')
    await expect(page.getByTestId('cat-drawn')).toHaveAttribute('data-new', 'true')
    await expect(page.getByTestId('cat-drawn')).toContainText('NEW! 새 고양이')
    await page.getByTestId('cat-reveal-close').click()
    await expect(page.getByTestId('cat-gacha')).toContainText('하늘냥 합류! 고유 스킬 메테오 스킬')
    await expect(page.getByTestId('cat-draw')).toContainText(`뽑기권 ${tickets - 1}장`)
    const detail = page.getByTestId('cat-detail')
    await expect(detail).toHaveAttribute('data-code', 'sky')
    // The cat's own skill starts at level 1 and says when it levels up (decisions.md 515).
    await expect(detail.getByTestId('cat-skill')).toContainText(
      '고유 스킬 메테오 스킬 Lv.1 · 고양이 Lv.3에 스킬 Lv.2',
    )
    await expect(detail.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-testid=cat-slot][data-code=sky]')).toBeVisible()
    const mates = () =>
      page.evaluate(
        () => (window as unknown as { __mentalDamage?: { mates: number } }).__mentalDamage?.mates,
      )
    await expect.poll(mates).toBe(1)
    await detail.getByTestId('cat-field').click()
    await expect(detail.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(mates).toBe(0)
    await detail.getByTestId('cat-field').click()
    // Four field slots: the fifth cat waits until one rests.
    for (let i = 0; i < 4; i++) await drawCat()
    await expect(detail).toHaveAttribute('data-code', 'night')
    await expect(detail.getByTestId('cat-field')).toBeDisabled()
    await expect(detail.getByTestId('cat-field')).toHaveText('칸 없음')
    await expect(detail).toContainText('치명타 피해 +25%')
    await expect.poll(mates).toBe(4)
    await page.locator('[data-testid=cat][data-code=sky]').click()
    await detail.getByTestId('cat-gun').click()
    await expect(detail.getByTestId('cat-weapon').first()).toBeVisible()
    await page.screenshot({ path: `/tmp/idle-cats-${width}.png`, fullPage: true })
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
    // Cats stand still while they shoot a wall; they walk only after breaking it (decisions.md 493).
    // 방향별 달리기는 프레임마다 새 키 대신 고양이별 캔버스 하나를 갱신한다.
    const running = async () =>
      (await market()).catTextures.some((key: string) => key.endsWith('-running'))
    await expect.poll(running, { timeout: 10000 }).toBe(false)
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
    assert(queue.every((wall) => wall.visible && wall.top >= 55))
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
      if (width === 390) {
        // The wall broke: every cat walks to the next one, then stops again.
        await expect.poll(running).toBe(true)
        await expect.poll(running, { timeout: 10000 }).toBe(false)
      }
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
    // The office no longer has its own inventory; weapons live in Growth (decisions.md 489).
    await expect(page.getByTestId('open-weapons')).toHaveCount(0)
    // Hiring draws at once with every usable ticket instead of opening a menu (decisions.md 490).
    await page.getByTestId('tab-market').click()
    await expect
      .poll(() => hires)
      .toEqual([
        Math.min(
          company.gacha.tickets,
          company.gacha.rosterMax - company.gacha.roster,
          company.gacha.maxDraws,
        ),
      ])
    await expect(page.getByTestId('office-scene')).toBeVisible()
    await expect(page.getByTestId('gacha-scene')).toHaveCount(0)
    const officeTicks = actions.filter((action) => action === 'tick').length
    await expect
      .poll(() => actions.filter((action) => action === 'tick').length)
      .toBeGreaterThan(officeTicks)
    const nav = page.getByRole('navigation', { name: '게임 메뉴' }).last()
    await expect(nav.getByRole('button')).toHaveCount(4)
    await expect(nav.getByRole('button', { name: '회사', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const name of ['성장', '고양이']) {
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
    await expect(page.getByTestId('idle-wall-number')).toBeVisible()
    await expect
      .poll(async () => {
        const queue = await queuedWalls()
        return queue.length === 2 && queue.every((wall) => wall.top >= 55)
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
