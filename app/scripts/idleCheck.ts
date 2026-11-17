import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const extraCats = JSON.parse(
  readFileSync(
    new URL('../../docs/mockups/2026-11-15-cat-roster-40/manifest.json', import.meta.url),
    'utf8',
  ),
) as { code: string; name: string }[]
const faceRects = JSON.parse(
  readFileSync(new URL('../src/idle/assets/cat-face-rects.json', import.meta.url), 'utf8'),
) as { faces: Record<string, { x: number; y: number; w: number; h: number }> }

// The shop tab carries a dot ("무료 상품 있음") while a free item is left (decisions.md 541).
const SHOP_MENU = /^상점( 무료 상품 있음)?$/
// Cats and weapons share one tab (560); it carries a dot while weapons can be merged.
const CAT_MENU = /^고양이·무기( 합칠 수 있는 무기 있음)?$/

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of process.env.UI_WIDTH ? [Number(process.env.UI_WIDTH)] : [320, 390, 1024]) {
    const company = {
      ...structuredClone(fixture),
      armory: { mergeCount: 2, lastDraw: null, lastDraws: [] },
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
      ],
      idle: {
        wall: 1,
        hp: 1200,
        maxHp: 1200,
        dps: 12,
        earned: 0,
        boss: false,
        circuitSeconds: 0,
        sequence: 0,
        upcoming: [] as { wall: number; hp: number; maxHp: number }[],
        skills: [
          { code: 'water', name: '물 스킬', owned: false, level: 0 },
          { code: 'meteor', name: '메테오 스킬', owned: false, level: 0 },
          { code: 'bolt', name: '번개 스킬', owned: false, level: 0 },
          { code: 'ram', name: '충차 스킬', owned: false, level: 0 },
        ],
        fieldSlots: 4,
        rebirth: { count: 0, fish: 0, gain: 0, fromWall: 51 },
        wallDps: 0,
        power: 1038,
        // Real-time income (#803): the HUD shows it under the capital. No offline payout yet.
        income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
        offline: null as { at: number; seconds: number; earned: number; capped: boolean } | null,
        cats: [
          // A cat's skills are its own (decisions.md 501). This fixture gives each of the first
          // cats one so the skill screens can be checked; the lilac cat has none and the snow cat
          // two, as C/B grade and S grade cats do on the server (561).
          ['sky', '하늘냥', 125, 100, 'meteor', '메테오 스킬'],
          ['mint', '민트냥', 100, 100, 'water', '물 스킬'],
          ['lilac', '라일락냥', 100, 150, '', ''],
          ['sunset', '노을냥', 110, 100, 'ram', '충차 스킬'],
          ['night', '밤냥', 100, 125, 'meteor', '메테오 스킬'],
          ['snow', '눈꽃냥', 140, 100, 'ice', '얼음 스킬'],
          ...extraCats.map((cat) => [cat.code, cat.name, 125, 100, 'meteor', '메테오 스킬']),
        ].map(([code, name, firePercent, criticalPercent, skill, skillName]) => ({
          code,
          name,
          level: 0,
          damagePercent: 50,
          firePercent,
          criticalPercent,
          fielded: false,
          skills: [
            ...(skill ? [{ code: skill, name: skillName }] : []),
            ...(code === 'snow' ? [{ code: 'wind', name: '바람 스킬' }] : []),
          ],
          // A skill gains a level at cat level 10, 20, 30, 40 (decisions.md 534).
          skillLevel: 1,
          skillNextLevel: 10,
          // 등급은 종마다 정해져 있다 (539번).
          grade: code === 'night' || code === 'snow' ? 'A' : 'C',
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
    const moves: string[] = []
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
        // The screen breaks walls ahead of the server (decisions.md 532); idleHitCheck covers that.
        // Here the server keeps the wall where the check puts it: it handles every heartbeat (the
        // screen forgets those hits) and credits none of them, so the screen never gets further
        // ahead than one heartbeat's hits, and those are far too few to break a wall this size.
        company.idle.sequence = body.sequence
      }
      // Cat gacha, fielding and equipment (decisions.md 488): the mock keeps the server's shape.
      const path = new URL(route.request().url()).pathname
      const sent = route.request().postDataJSON()
      // The retreat after the buy wall fell (decisions.md 546): ten walls back, never behind
      // the last cleared boss (every 50th wall, 547 and 548).
      if (path.endsWith('/idle/retreat')) {
        moves.push('retreat')
        const wall = company.idle.wall
        company.idle.wall = Math.max(Math.floor((wall - 1) / 50) * 50 + 1, wall - 10)
        company.idle.boss = company.idle.wall % 50 === 0
        company.idle.hp = company.idle.maxHp = 1200
        company.idle.circuitSeconds = 0
        Object.assign(company.idle, {
          epoch: ((company.idle as { epoch?: number }).epoch ?? 0) + 1,
        })
      }
      const cat = company.idle.cats.find((c) => c.code === sent?.code)
      if (path.endsWith('/draws')) hires.push(sent.count)
      if (path.endsWith('/cat/draw')) {
        const drawn = company.idle.cats[catDraws++ % 6]
        company.diamonds.amount -= company.diamonds.draw
        drawn.level++
        drawn.damagePercent = 50 + (drawn.level - 1) * 10
        if (drawn.level === 1 && company.idle.cats.filter((c) => c.fielded).length < 4)
          drawn.fielded = true
      } else if (path.includes('/shop/')) {
        const item = company.shop.items.find((i) => path.endsWith(`/shop/${i.code}`))
        if (item) {
          item.left--
          company.diamonds.amount += item.giveDiamonds - item.priceDiamonds
          company.shop.lastReceipt = {
            code: item.code,
            diamonds: item.giveDiamonds,
            money: item.giveMoney ?? 0,
          } as never
        }
      } else if (path.endsWith('/cat/field') && cat) {
        cat.fielded = sent.fielded
      } else if (path.endsWith('/cat/weapon') && cat) {
        cat.weapon = sent.kind ? { kind: sent.kind, grade: sent.grade } : null
      }
      for (const skill of company.idle.skills) {
        skill.owned = company.idle.cats.some(
          (c) => c.fielded && c.skills.some((own) => own.code === skill.code),
        )
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
        new CustomEvent('idle-wall-hit', {
          detail: { wall: 1, kind: 'bullet', depth: 0, damage: 1 },
        }),
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
    // A안: 하단 탭은 캔버스 밖에 두고, 상단은 첫 매도벽보다 위에 유지한다. 전투 공간과 탭 사이의 단추 줄은 없다 (567번).
    const arenaBounds = await page.getByTestId('idle-canvas').boundingBox()
    const navBounds = await page.getByRole('navigation', { name: '게임 메뉴' }).boundingBox()
    const hudBounds = await page.locator('.idle-hud').boundingBox()
    assert(arenaBounds && navBounds && hudBounds)
    assert(arenaBounds.height > 0 && arenaBounds.y + arenaBounds.height <= navBounds.y + 1)
    assert(hudBounds.y + hudBounds.height <= 55)
    await expect(page.getByRole('toolbar')).toHaveCount(0)
    // 시즌패스와 설정은 위 줄 안에 있고 (567번), 출석 단추는 없다 (566번).
    for (const id of ['idle-pass', 'idle-options']) {
      const box = await page.getByTestId(id).boundingBox()
      assert(box, `${id} is shown`)
      assert(box.y >= hudBounds.y && box.y + box.height <= hudBounds.y + hudBounds.height, id)
      assert(box.x + box.width <= hudBounds.x + hudBounds.width, `${id} stays inside the HUD`)
    }
    await expect(page.getByTestId('idle-attendance')).toHaveCount(0)
    await page.getByTestId('idle-options').click()
    await expect(page.getByTestId('sound-toggle')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sound-toggle')).toHaveCount(0)
    // 시즌패스 (570번): 미션과 진행도가 보이고 보상에 돈이 없다.
    await page.getByTestId('idle-pass').click()
    await expect(page.getByTestId('pass-mission')).toHaveCount(6)
    await expect(page.locator('[data-testid=pass-mission][data-code=wall]')).toContainText(
      '매도벽 100개 통과',
    )
    await expect(page.locator('[data-testid=pass-mission][data-code=wall]')).toContainText('73/100')
    await expect(page.locator('[data-testid=pass-mission][data-code=wall]')).toContainText('30P')
    await expect(page.getByTestId('pass-exp')).toHaveText('120 / 300P')
    await expect(page.getByTestId('pass').locator('.idle-coin')).toHaveCount(0)
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    await expect(page.getByTestId('pass')).toHaveCount(0)
    await page.getByRole('button', { name: '성장' }).click()
    await expect(page.getByTestId('idle-menu')).toBeVisible()
    // 전투력 하나만 보인다 (538번): 화력과 실제 벽 피해는 뺐다.
    await expect(page.getByTestId('idle-power')).toContainText('전투력')
    await expect(page.getByTestId('idle-power')).toContainText('1,038')
    await expect(page.getByText('실제 벽 피해')).toHaveCount(0)
    // Four stats (decisions.md 487): fire speed stops at its cap, the others can be bought.
    await expect(page.getByTestId('idle-stat')).toHaveCount(4)
    const stat = (kind: string) => page.locator(`[data-testid=idle-stat][data-kind=${kind}]`)
    await expect(stat('fire')).toContainText('공격 속도')
    await expect(stat('fire')).toContainText('+100% · 최대')
    await expect(stat('fire').getByRole('button')).toBeDisabled()
    await expect(stat('fire').getByRole('button')).toHaveText('MAX')
    await expect(stat('hp')).toContainText('매수벽 체력')
    await expect(stat('buy')).toContainText('매수벽 공격')
    await expect(stat('crit')).toHaveCount(0)
    // 환생 (571번): 성장 탭 맨 아래. 첫 보스를 깨기 전에는 언제부터 되는지만 알린다.
    await expect(page.getByTestId('rebirth')).toBeVisible()
    await expect(page.getByTestId('rebirth-open')).toBeDisabled()
    await expect(page.getByTestId('rebirth-open')).toHaveText('매도벽 51부터 환생할 수 있어요')
    await page.screenshot({ path: `/tmp/idle-growth-${width}.png`, fullPage: true })
    // Growth holds the stats only (decisions.md 530): no tab row, no inventory, no skill list.
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByTestId('weapon-picker')).toHaveCount(0)
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    // Cats are drawn with diamonds (decisions.md 526), fielded in four slots, and shown in a scrolling six-column roster (488, 493, 495).
    await page.getByRole('button', { name: CAT_MENU }).click()
    await expect(page.locator('.idle-cat-grid > li')).toHaveCount(42)
    await expect(page.getByTestId('cat')).toHaveCount(39)
    await expect(page.getByTestId('cat-slot')).toHaveCount(4)
    await expect(page.getByTestId('cat-field')).toHaveCount(0)
    // Every cat wears its grade (decisions.md 539), owned or not.
    await expect(page.locator('[data-testid=cat][data-code=night]')).toHaveAttribute(
      'data-grade',
      'A',
    )
    // The draws moved to the shop tab (541); the cats tab keeps the roster only.
    await expect(page.getByTestId('cat-gacha')).toHaveCount(0)
    const toShop = () => page.getByRole('button', { name: SHOP_MENU }).last().click()
    const toCats = () => page.getByRole('button', { name: CAT_MENU }).last().click()
    const pickCat = (code: string) => page.locator(`[data-testid=cat][data-code=${code}]`).click()
    await toShop()
    const diamonds = company.diamonds.amount
    // The draw buttons carry their diamond prices, and the ten-pull shows its bonus (+1).
    await expect(page.getByTestId('cat-draw')).toContainText('다이아 100개')
    await expect(page.getByTestId('cat-draw-ten')).toContainText('10연차')
    await expect(page.getByTestId('cat-draw-ten')).toContainText('다이아 1,000개')
    await expect(page.getByTestId('cat-draw-ten').getByTestId('ten-bonus')).toHaveText('+1')
    // The odds by grade are written under the draw (539).
    await expect(page.getByTestId('draw-note')).toContainText('S 2% · A 10% · B 28% · C 60%')
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
    await expect(page.getByTestId('cat-drawn-grade')).toContainText('C 등급')
    await expect(page.getByTestId('cat-drawn').getByTestId('skill-badge')).toHaveAttribute(
      'data-skill',
      'meteor',
    )
    await page.getByTestId('cat-reveal-close').click()
    await expect(page.getByTestId('cat-gacha')).toContainText(
      'C 등급 하늘냥 합류! 고유 스킬 메테오 스킬',
    )
    assert.equal(company.diamonds.amount, diamonds - company.diamonds.draw)
    // Today's goods (541): four items; the free one is taken once and the tab's dot goes out.
    await expect(page.getByTestId('shop-item')).toHaveCount(4)
    const free = page.locator('[data-testid=shop-item][data-code=free]')
    await expect(free).toContainText('다이아 20개')
    await expect(free.getByTestId('shop-buy')).toContainText('무료')
    await expect(page.getByTestId('shop-dot').last()).toBeVisible()
    await free.getByTestId('shop-buy').click()
    await expect(page.getByTestId('shop-got')).toHaveText(
      '오늘의 무료 다이아: 다이아 20개 받았어요',
    )
    await expect(free.getByTestId('shop-buy')).toBeDisabled()
    await expect(free).toContainText('오늘 0 / 1번 남음')
    await expect(page.getByTestId('shop-dot')).toHaveCount(0)
    assert.equal(company.diamonds.amount, diamonds - company.diamonds.draw + 20)
    await expect(page.locator('[data-testid=shop-item][data-code=money-small]')).toContainText(
      '수입 30분어치',
    )
    await page.screenshot({ path: `/tmp/idle-shop-${width}.png`, fullPage: true })
    await toCats()
    await pickCat('sky')
    const detail = page.getByTestId('cat-detail')
    await expect(detail).toHaveAttribute('data-code', 'sky')
    await detail.locator('summary').click()
    // The cat's own skill starts at level 1 and says when it levels up (decisions.md 515).
    // Picking a cat explains its skill (decisions.md 530): what it does, how it grows, the next level.
    await expect(detail.getByTestId('cat-skill')).toContainText('고유 스킬 메테오 스킬 Lv.1')
    await expect(detail.getByTestId('cat-skill')).toContainText('운석 → 대운석 → 유성우')
    // The skill wears its badge (decisions.md 531): large here, small on the slot and the grid cell.
    const badge = detail.getByTestId('cat-skill').getByTestId('skill-badge').first()
    await expect(badge).toHaveAttribute('data-skill', 'meteor')
    await expect(badge).toHaveAttribute('data-level', '1')
    await expect(
      page.locator('[data-testid=cat-slot][data-code=sky]').getByTestId('skill-badge'),
    ).toHaveAttribute('data-skill', 'meteor')
    // A cat not drawn yet shows its skill locked.
    await expect(
      page.locator('[data-testid=cat][data-code=mint]').getByTestId('skill-badge'),
    ).toHaveAttribute('data-level', '0')
    // Skills start at A grade (561): a cat without one wears no badge, a cat with two wears both.
    await expect(
      page.locator('[data-testid=cat][data-code=lilac]').getByTestId('skill-badge'),
    ).toHaveCount(0)
    const twin = page.locator('[data-testid=cat][data-code=snow]').getByTestId('skill-badge')
    await expect(twin).toHaveCount(2)
    await expect(twin.first()).toHaveAttribute('data-skill', 'ice')
    await expect(twin.last()).toHaveAttribute('data-skill', 'wind')
    // The glint twinkles gently, and stays still when motion is reduced.
    assert.equal(
      await badge
        .locator('.skill-badge-glints path')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      width === 390 ? 'skill-badge-glint' : 'none',
    )
    await expect(detail.getByTestId('cat-skill-next')).toHaveText(
      '고양이 Lv.10에 스킬 Lv.2 · 앞으로 9레벨',
    )
    await expect(detail.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-testid=cat-slot][data-code=sky]')).toBeVisible()
    const mates = () =>
      page.evaluate(
        () => (window as unknown as { __mentalDamage?: { mates: number } }).__mentalDamage?.mates,
      )
    await expect.poll(mates).toBe(1)
    // The fielded cat wears its own skill's picture overhead, not the old magic star (557).
    const skillMarks = () =>
      page.evaluate(
        () =>
          (window as unknown as { __mentalDamage?: { skillMarks: string[][] } }).__mentalDamage
            ?.skillMarks,
      )
    await expect.poll(skillMarks).toEqual([['meteor']])
    await detail.getByTestId('cat-field').click()
    await expect(detail.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(mates).toBe(0)
    await detail.getByTestId('cat-field').click()
    // Four field slots: the fifth cat waits until one rests.
    await toShop()
    for (let i = 0; i < 4; i++) await drawCat()
    await toCats()
    await pickCat('night')
    await expect(detail).toHaveAttribute('data-code', 'night')
    await expect(detail.getByTestId('cat-grade')).toHaveText('A')
    await expect(detail.getByTestId('cat-field')).toBeDisabled()
    await expect(detail.getByTestId('cat-field')).toHaveText('칸 없음')
    await expect(detail).toContainText('치명타 피해 +25%')
    await expect.poll(mates).toBe(4)
    // The last approved companion is visible below the fold and uses its own portrait/texture.
    const finalCat = company.idle.cats.at(-1)
    assert(finalCat)
    finalCat.level = 1
    await page.locator('[data-testid=cat][data-code=sky]').click()
    await detail.getByTestId('cat-field').click()
    const lastCat = page.locator('[data-testid=cat][data-code=oat]')
    await expect(lastCat).toBeEnabled()
    await lastCat.click()
    await expect(detail).toHaveAttribute('data-code', 'oat')
    await expect(detail.locator('.idle-cat-face image')).toHaveAttribute('href', /cat-faces/)
    const oat = faceRects.faces.oat
    await expect(detail.locator('.idle-cat-face')).toHaveAttribute(
      'viewBox',
      `${oat.x} ${oat.y} ${oat.w} ${oat.h}`,
    )
    await detail.getByTestId('cat-field').click()
    await expect.poll(mates).toBe(4)
    await expect(page.locator('[data-testid=cat-slot][data-code=oat]')).toBeVisible()
    await page.screenshot({ path: `/tmp/idle-roster-40-${width}.png`, fullPage: true })
    if (process.env.ROSTER_ONLY === '1') {
      assert.deepEqual(errors, [])
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      )
      console.log(`PASS: 39 companion cards, last companion portrait and fielding at ${width}px`)
      await page.close()
      continue
    }
    await detail.getByTestId('cat-field').click()
    await page.locator('[data-testid=cat][data-code=sky]').click()
    await detail.getByTestId('cat-field').click()
    await page.screenshot({ path: `/tmp/idle-cats-${width}.png`, fullPage: true })
    // Equipment opens inside the cat tray (560: there is no separate weapons tab) and keeps the
    // wearer; picking the boss cat there keeps the equipment list open.
    await detail.getByTestId('cat-gun').click()
    await expect(detail).toHaveAttribute('data-code', 'sky')
    await expect(page.getByTestId('cat-gear')).toBeVisible()
    await expect(page.getByTestId('cat-weapon').first()).toBeVisible()
    await page.getByTestId('cat-boss').click()
    await expect(detail).toHaveAttribute('data-code', 'boss')
    await expect(page.getByTestId('cat-boss')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('cat-gear')).toBeVisible()
    await page.screenshot({ path: `/tmp/idle-weapons-${width}.png`, fullPage: true })
    // The weapon draw is in the shop: the link opens it on the weapon draw.
    await page.getByTestId('weapon-to-shop').click()
    await expect(page.getByTestId('cat-gacha')).toHaveAttribute('data-kind', 'weapon')
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
            }
          }
        ).__mentalMarket(),
      )
    assert.equal((await market()).simSpeed, 1) // Existing 2x speed uses simScale(2) = 1.
    // 서킷브레이커는 꺼 두었다(IdleEngine.CIRCUIT_ENABLED): 여기서는 켜서 보지 않는다.
    // 앱이 뒤로 가면 서버에 멈춤을 알리고 전투 시계가 선다. 돌아오면 다시 흐른다.
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
    )
    await expect.poll(() => actions.at(-1)).toBe('stop')
    await expect.poll(async () => (await market()).physicsPaused).toBe(true)
    const stoppedClock = (await market()).battleSeconds
    await page.waitForTimeout(800)
    assert.equal((await market()).battleSeconds, stoppedClock)
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('idle-app-active', { detail: true })),
    )
    await expect.poll(async () => (await market()).physicsPaused).toBe(false)
    await expect.poll(async () => (await market()).battleSeconds).toBeGreaterThan(stoppedClock)
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
                  label: string
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
    // The queue is rebuilt while a broken wall falls: a read in that moment finds it empty. These
    // reads wait for the two walls to be back instead of throwing on an empty queue.
    const rearWalls = async () => {
      for (;;) {
        await expect.poll(async () => (await queuedWalls()).length).toBe(2)
        const walls = await queuedWalls()
        if (walls.length === 2) return walls
      }
    }
    const intact = (await rearWalls())[0].crack
    company.idle.upcoming = [
      { wall: 7, hp: 30, maxHp: 264 },
      { wall: 8, hp: 100, maxHp: 288 },
    ]
    // The server's 30, less the pierced hits it has not handled yet (decisions.md 520, 532).
    await expect
      .poll(async () => (await queuedWalls())[0]?.hp ?? Number.POSITIVE_INFINITY)
      .toBeLessThanOrEqual(30)
    const rear = await rearWalls()
    assert(rear[0].hp >= 1)
    assert.notEqual(rear[0].crack, intact)
    // The walls behind show their remaining shares only (decisions.md 542): 30 of 264 health is
    // at most 4,500 of 39,600 shares, and the untouched one further back still reads more.
    const labels = rear.map((wall) => wall.label)
    assert(
      labels.every((label) => /^[\d,]+주$/.test(label)),
      `rear wall labels: ${labels}`,
    )
    const sharesOn = (label: string) => Number(label.replace(/[^\d]/g, ''))
    assert(sharesOn(labels[0]) >= 100 && sharesOn(labels[0]) <= 4500, labels[0])
    assert(sharesOn(labels[1]) > sharesOn(labels[0]), labels.join(' / '))
    await page.screenshot({
      path: `/tmp/idle-rear-${width}.png`,
      clip: { x: 0, y: 40, width, height: 260 },
    })
    const cash = await page.locator('.idle-cash').first().boundingBox()
    const number = await page.getByTestId('idle-wall-number').boundingBox()
    assert(cash && number && cash.x + cash.width <= number.x)
    // Income per second sits under the capital, inside the chip (#803).
    await expect(page.getByTestId('idle-income')).toHaveText('+48.5a/초')
    const income = await page.getByTestId('idle-income').boundingBox()
    assert(income && income.y >= cash.y && income.y + income.height <= cash.y + cash.height + 0.5)
    assert(income.x + income.width <= cash.x + cash.width + 0.5, 'income fits the capital chip')
    // The company tab is off (decisions.md 540), so its meeting dot is not shown either.
    await expect(page.getByTestId('meeting-dot')).toHaveCount(0)
    await expect(page.getByTestId('offline-income')).toHaveCount(0)
    const queue = await queuedWalls()
    assert(queue.every((wall) => wall.visible && wall.top >= 55))
    assert(queue[1].bottom < queue[0].top)
    await page.screenshot({ path: `/tmp/idle-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '성장' }).click()
    await page.screenshot({ path: `/tmp/idle-growth-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    if (width === 390) {
      // Twenty times the hits in a heartbeat: the wall must be too big for those as well.
      company.idle.hp = company.idle.maxHp = 1e9
      await page.waitForTimeout(1200)
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
      // The last fast hits are handled before the wall goes back to its size.
      await page.waitForTimeout(1500)
      company.idle.hp = company.idle.maxHp = 1200
      company.idle.wall = 8
      if (width === 390) {
        // The wall broke: every cat walks to the next one, then stops again.
        await expect.poll(running).toBe(true)
        await expect.poll(running, { timeout: 10000 }).toBe(false)
      }
      await expect.poll(async () => (await queuedWalls()).map((wall) => wall.wall)).toEqual([9, 10])
      // The tenth wall is an ordinary wall now (550): no big wall, no halt.
      assert.equal((await queuedWalls())[1].boss, false)
      company.idle.wall = 10
      await expect(page.getByTestId('idle-wall-number')).toHaveText('매도벽 10')
      await expect(page.getByTestId('idle-wall-number')).toHaveAttribute('data-state', 'auto')
      await expect
        .poll(async () => (await queuedWalls()).map((wall) => wall.wall))
        .toEqual([11, 12])
      // The boss wall stands at every 50th wall only: it shows behind wall 48 and 49.
      company.idle.wall = 48
      await expect
        .poll(async () => (await queuedWalls()).map((wall) => wall.boss))
        .toEqual([false, true])
      // The boss challenge comes by itself and starts with a circuit breaker.
      company.idle.wall = 50
      company.idle.boss = true
      company.idle.circuitSeconds = 4
      await expect(page.getByTestId('idle-wall-number')).toHaveText('거래 정지')
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              (window as unknown as { __mentalMarket: () => { circuit: unknown } }).__mentalMarket()
                .circuit,
            ),
          ),
        )
        .toBe(true)
      // The halt starts on an empty field (549): no bullet is left flying.
      assert.equal(
        await page.evaluate(
          () =>
            (window as unknown as { __mentalMarket: () => { bullets: number } }).__mentalMarket()
              .bullets,
        ),
        0,
        'no bullet is left when the boss circuit breaker starts',
      )
      await page.screenshot({ path: '/tmp/idle-boss-circuit.png' })
      company.idle.circuitSeconds = 0
      await expect(page.getByTestId('idle-wall-number')).toHaveText('보스 50', { timeout: 10000 })
      await expect(page.getByTestId('idle-wall-number')).toHaveAttribute('data-state', 'boss')
      await page.screenshot({ path: '/tmp/idle-boss.png' })
      // Clearing the boss pays its own reward, told once (549).
      Object.assign(company.idle, { bossReward: { wall: 50, diamonds: 100, money: 123_000_000 } })
      await expect(page.getByTestId('idle-raid')).toContainText('보스 50 클리어! 다이아 +100')
      await page.screenshot({ path: '/tmp/idle-boss-reward.png' })
      // The buy wall falls: every enemy is gone and the fight goes ten walls back (546).
      // The long fast fight above may have lost its buy wall and gone back already.
      moves.length = 0
      await page.waitForTimeout(1500)
      const flowsLeft = await page.evaluate(() => {
        const dev = window as unknown as {
          __mentalBuyWallHit: (n: number) => void
          __mentalMarket: () => { flows: number }
        }
        dev.__mentalBuyWallHit(1e12)
        return dev.__mentalMarket().flows
      })
      assert.equal(flowsLeft, 0, 'no sell order or monster is left when the buy wall falls')
      await expect(page.getByTestId('idle-raid')).toContainText('매수벽 붕괴')
      await expect(page.getByTestId('idle-wall-number')).toHaveText('매도벽 40')
      assert.deepEqual(moves, ['retreat'])
      await page.screenshot({ path: '/tmp/idle-retreat.png' })
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
    await expect
      .poll(async () => (await queuedWalls()).map((wall) => wall.wall))
      .toEqual([company.idle.wall + 1, company.idle.wall + 2])
    // The company tab is switched off (decisions.md 540): no tab, no ☰ button, no office screen.
    await expect(page.getByRole('button', { name: /^회사/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '회사 메뉴' })).toHaveCount(0)
    const nav = page.getByRole('navigation', { name: '게임 메뉴' }).last()
    await expect(nav.getByRole('button')).toHaveCount(4)
    await expect(nav.getByRole('button', { name: /^무기/ })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '돌파', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const name of [/^성장/, CAT_MENU, SHOP_MENU]) {
      const tab = page
        .getByRole('navigation', { name: '게임 메뉴' })
        .last()
        .getByRole('button', typeof name === 'string' ? { name, exact: true } : { name })
      await tab.click()
      await expect(page.getByTestId('idle-menu')).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: '게임 메뉴' })
          .last()
          .getByRole('button', typeof name === 'string' ? { name, exact: true } : { name }),
      ).toHaveAttribute('aria-current', 'page')
      await page.getByRole('button', { name: '닫기 ✕' }).click()
      await expect(page.getByTestId('idle-menu')).toHaveCount(0)
    }
    await expect(page.getByTestId('office-scene')).toHaveCount(0)
    // A short viewport keeps the fixed navigation on screen.
    await page.setViewportSize({ width, height: 640 })
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
    'PASS: main view, heartbeat, background stop/resume, skill gating, four tabs, 320/390/1024px',
  )
} finally {
  await browser.close()
}
