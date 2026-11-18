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
          // 매수벽 공격은 %가 아니라 수량으로 오른다 (579번): 한 단계에 10주.
          kind: 'buy',
          level: 12,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 0,
          bonusShares: 120,
          nextBonusShares: 130,
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
        rebirth: {
          count: 0,
          fish: 0,
          gain: 0,
          fromWall: 51,
          adGain: 0,
          // 영구 강화 (600번).
          upgrades: ['damage', 'hp', 'buy'].map((kind) => ({
            kind,
            level: 0,
            cost: 1,
            bonus: 0,
            nextBonus: kind === 'buy' ? 10 : 1,
          })),
        },
        // 고유 스킬 여섯(587·591번, 앞의 셋을 장착)과 광고 스킬 셋(588번). 시간은 실제 초다.
        activeSlots: 3,
        actives: [
          ['barrage', '매수세례', 40, 4, false],
          ['rally', '불장', 60, 6.7, false],
          ['fortify', '방어선 구축', 60, 4, false],
          ['limitUp', '상한가', 60, 8, false],
          ['stopLoss', '손절', 60, 0, false],
          ['averaging', '물타기', 60, 10, false],
          ['boostFire', '공격속도 3배', 180, 180, true],
          ['boostDamage', '공격력 3배', 180, 180, true],
          ['boostBuy', '매수공격 3배', 180, 180, true],
        ].map(([code, name, cooldown, seconds, ad], index) => ({
          code,
          name,
          cooldown,
          seconds,
          readyIn: 0,
          left: 0,
          equipped: index < 3,
          ad,
        })) as {
          code: string
          name: string
          cooldown: number
          seconds: number
          readyIn: number
          left: number
          equipped: boolean
          ad: boolean
        }[],
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
    // Calls to the retired retreat address (584): a fallen buy wall no longer moves the fight.
    const moves: string[] = []
    const rebirths: { ad?: boolean }[] = []
    const usedActives: { code: string; ad?: boolean }[] = []
    const equips: { code: string; equipped: boolean }[] = []
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
      if (path.endsWith('/idle/retreat')) moves.push('retreat')
      // Active skills (503, 587, 588): a use starts the cooldown, and an ad skill's effect too.
      if (path.endsWith('/idle/active')) {
        usedActives.push(sent)
        const active = company.idle.actives.find((a) => a.code === sent.code)
        if (active) {
          active.readyIn = active.cooldown
          if (active.ad) active.left = active.seconds
        }
      }
      if (path.endsWith('/idle/active/equip')) {
        equips.push(sent)
        const active = company.idle.actives.find((a) => a.code === sent.code)
        if (active) active.equipped = sent.equipped
      }
      // Rebirth (571, 586): the fish it paid, three times as many after an ad.
      if (path.endsWith('/company/rebirth')) {
        const rebirth = company.idle.rebirth
        rebirths.push(sent)
        rebirth.fish += sent?.ad ? rebirth.adGain : rebirth.gain
        rebirth.count++
        rebirth.gain = rebirth.adGain = 0
      }
      // 영구 강화 (600번): 생선을 쓰고 한 단계 오른다.
      if (path.endsWith('/rebirth/upgrade')) {
        const rebirth = company.idle.rebirth
        const u = rebirth.upgrades.find((u) => u.kind === sent.kind)
        if (u) {
          rebirth.fish -= u.cost
          u.level++
          u.cost = u.level + 1
          u.bonus = u.nextBonus
          u.nextBonus += u.kind === 'buy' ? 10 : 1
        }
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
      } else if (path.endsWith('/pass/missions/claim')) {
        for (const mission of company.pass.missions) {
          if (sent?.code && mission.code !== sent.code) continue
          company.pass.points += mission.ready
          mission.earned += mission.ready
          mission.ready = 0
        }
        company.pass.missionsReady = 0
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
    // CI 러너의 네트워크가 바뀌는 순간(앞 단계의 도커 네트워크가 내려갈 때) 크롬은 진행 중인 요청을 모두
    // net::ERR_NETWORK_CHANGED로 끊는다. 그러면 전투 모듈을 받지 못해 화면이 "다시 시도"에 멈춘다. 앱의 잘못이 아니므로
    // 그 오류로 전투가 뜨지 않았을 때만 화면을 새로 받아 다시 본다. 다른 까닭으로 뜨지 않으면 아래 검사가 그대로 잡는다.
    for (let reload = 0; reload < 3; reload++) {
      const opened = await page
        .locator('[data-testid=idle-canvas] canvas')
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false)
      if (opened || !loadingErrors.some((line) => line.includes('ERR_NETWORK_CHANGED'))) break
      console.log(`network changed while loading (width ${width}): reloading, try ${reload + 1}`)
      loadingErrors.length = 0
      await page.reload()
    }
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
    await expect(page.locator('[data-testid=idle-canvas] canvas'))
      .toBeVisible({ timeout: 30000 })
      .catch(async (e) => {
        // Why the battle did not open: the page logs the cause to the console (#836).
        console.log({ width, errors, loadingErrors })
        await page.screenshot({ path: `/tmp/idle-failure-${width}.png` }).catch(() => {})
        throw e
      })
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
      '매도벽 최고 기록 100개 돌파',
    )
    await expect(page.locator('[data-testid=pass-mission][data-code=wall]')).toContainText('73/100')
    await expect(page.locator('[data-testid=pass-mission][data-code=wall]')).toContainText('30P')
    await expect(page.getByTestId('pass-exp')).toHaveText('120 / 300P')
    // 포인트는 눌러서 받는다 (572번): 받을 것이 있는 미션에만 받기 단추가 서고, 누르면 그 미션을 받는다.
    await expect(page.getByTestId('pass-mission-claim')).toHaveCount(1)
    const attend = page.locator('[data-testid=pass-mission][data-code=attend]')
    await expect(attend.getByTestId('pass-mission-claim')).toHaveText('받기 +100P')
    await attend.getByTestId('pass-mission-claim').click()
    await expect(page.getByTestId('pass-got')).toContainText('포인트 +100P')
    await expect(page.getByTestId('pass-mission-claim')).toHaveCount(0)
    await expect(page.getByTestId('pass-exp')).toHaveText('220 / 300P')
    await expect(page.getByTestId('pass-badge')).toHaveCount(0)
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
    // %가 아니라 수량으로 적는다 (579번): 바탕 한 장 225주(594번)에 120주를 얹었다.
    await expect(stat('buy')).toContainText('+120주 → +130주')
    await expect(stat('buy')).toContainText('매수 주문 한 장 345주')
    await expect(stat('buy')).not.toContainText('%')
    await expect(stat('crit')).toHaveCount(0)
    // 성장 탭은 강화와 영구 강화로 나뉜다 (600번). 환생 (571번)은 영구 강화 아래에 있고, 첫 보스를 깨기 전에는 언제부터 되는지만 알린다.
    await expect(page.getByRole('tab')).toHaveText(['강화', /^영구 강화/])
    await expect(page.getByTestId('rebirth')).toHaveCount(0)
    await page.getByTestId('growth-tab-forever').click()
    await expect(page.locator('[data-testid=idle-stat]')).toHaveCount(0)
    const forever = (kind: string) => page.locator(`[data-testid=fish-upgrade][data-kind=${kind}]`)
    await expect(page.getByTestId('fish-upgrade')).toHaveCount(3)
    await expect(forever('damage')).toContainText('공격력 Lv.0')
    await expect(forever('damage')).toContainText('+0% → +1%')
    await expect(forever('buy')).toContainText('+0주 → +10주')
    await expect(forever('damage').getByRole('button')).toBeDisabled()
    await expect(page.getByTestId('rebirth')).toBeVisible()
    await expect(page.getByTestId('rebirth-open')).toBeDisabled()
    await expect(page.getByTestId('rebirth-open')).toHaveText('매도벽 51부터 환생할 수 있어요')
    // 광고 보고 3배 받기 (586번): 환생을 물을 때 고른다. 아직 광고가 없어 누르면 바로 3배로 환생한다.
    Object.assign(company.idle.rebirth, { gain: 20, adGain: 60 })
    await expect(page.getByTestId('rebirth-open')).toContainText('20마리 받기')
    await page.getByTestId('rebirth-open').click()
    await expect(page.getByTestId('rebirth-confirm')).toContainText('그냥 환생')
    await expect(page.getByTestId('rebirth-confirm')).toContainText('20')
    await expect(page.getByTestId('rebirth-ad')).toContainText('광고 보고 3배 받기')
    await expect(page.getByTestId('rebirth-ad')).toContainText('60')
    await expect(page.getByTestId('rebirth-ad')).toBeEnabled()
    await page.screenshot({ path: `/tmp/idle-rebirth-ad-${width}.png` })
    await page.getByTestId('rebirth-ad').click()
    await expect(page.getByTestId('rebirth-got')).toContainText('생선 60마리를 받았어요')
    assert.deepEqual(rebirths, [{ ad: true }])
    await expect(page.getByTestId('rebirth-fish')).toContainText('60')
    await expect(page.getByTestId('rebirth-open')).toBeDisabled()
    // 받은 생선으로 영구 강화를 올린다 (600번).
    await forever('damage').getByRole('button').click()
    await expect(forever('damage')).toContainText('공격력 Lv.1')
    await expect(forever('damage')).toContainText('+1% → +2%')
    await expect(page.getByTestId('rebirth-fish')).toContainText('59')
    await expect(page.getByTestId('growth-tab-forever')).toContainText('59')
    await page.screenshot({ path: `/tmp/idle-growth-${width}.png`, fullPage: true })
    // Growth holds the stats only (decisions.md 530): no inventory, no skill list. Its two tabs are 강화 and 영구 강화 (600).
    await expect(page.getByRole('tab')).toHaveCount(2)
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
    // Today's goods (541): one free item; the free one is taken once and the tab's dot goes out.
    await expect(page.getByTestId('shop-item')).toHaveCount(1)
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
    await expect(page.locator('[data-testid=shop-item]:not([data-code=free])')).toHaveCount(0)
    await expect(page.locator('.idle-shop-item .shop-art-icon')).toHaveCount(1)
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
    // With the team full its button offers a swap instead of a dead "칸 없음" (#910).
    await expect(detail.getByTestId('cat-field')).toHaveCount(0)
    await expect(detail.getByTestId('cat-swap')).toHaveText('교체')
    await expect(detail.getByTestId('cat-swap')).toBeEnabled()
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
    // The fight runs at 1.5x (decisions.md 580): simScale(1.5) = 0.75.
    assert.equal((await market()).simSpeed, 0.75)
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
    // Wait for a settled queue and retain that exact snapshot. Combat keeps running during
    // screenshots and DOM checks, so a later read can find the next wall falling or an empty queue.
    const rearWalls = async () => {
      let walls: Awaited<ReturnType<typeof queuedWalls>> = []
      await expect
        .poll(async () => {
          walls = await queuedWalls()
          return (
            walls.length === 2 &&
            walls.every((wall) => wall.visible && wall.top >= 55) &&
            walls[1].bottom < walls[0].top
          )
        })
        .toBe(true)
      return walls
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
    const queue = rear
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
      // 서버가 정지를 끝내기 전에는 차단벽이 열리지 않는다 (595번): 화면의 시계가 먼저 다 가도 열리기 직전(3.7초)에서 기다린다.
      await page.waitForTimeout(3000)
      const halted = await page.evaluate(
        () =>
          (
            window as unknown as { __mentalMarket: () => { circuit: { elapsed: number } | null } }
          ).__mentalMarket().circuit,
      )
      assert.ok(halted, 'the halt lasts while the server says so')
      assert.ok(halted.elapsed <= 3.7 + 1e-6, `the barrier stays closed: ${halted.elapsed}`)
      await page.screenshot({ path: '/tmp/idle-boss-circuit.png' })
      company.idle.circuitSeconds = 0
      await expect(page.getByTestId('idle-wall-number')).toHaveText('보스 50', { timeout: 10000 })
      await expect(page.getByTestId('idle-wall-number')).toHaveAttribute('data-state', 'boss')
      await page.screenshot({ path: '/tmp/idle-boss.png' })
      // Clearing the boss pays its own reward, told once (549).
      Object.assign(company.idle, { bossReward: { wall: 50, diamonds: 100, money: 123_000_000 } })
      await expect(page.getByTestId('boss-reward')).toContainText('보스 50 클리어!')
      await expect(page.getByTestId('boss-reward')).toContainText('+100')
      await page.screenshot({ path: '/tmp/idle-boss-reward.png' })
      // The buy wall falls: every enemy is gone and the fight stays at its wall (584). It used to
      // go ten walls back (546).
      await page.waitForTimeout(1500)
      // A just-rebuilt wall may still be protected. Only inspect cleanup after a hit actually
      // breaks it, in the same browser task so the next frame cannot spawn another enemy.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const dev = window as unknown as {
                __mentalBuyWallHit: (n: number) => void
                __mentalMarket: () => { flows: number; buyWall: { breaks: number } }
              }
              const before = dev.__mentalMarket().buyWall.breaks
              dev.__mentalBuyWallHit(1e12)
              const after = dev.__mentalMarket()
              return after.buyWall.breaks > before ? after.flows : null
            }),
          { timeout: 10000, intervals: [100] },
        )
        .toBe(0)
      await expect(page.getByTestId('idle-raid')).toContainText('매수벽 붕괴! 다시 세우는 중')
      await expect(page.getByTestId('idle-wall-number')).toHaveText('보스 50')
      assert.deepEqual(moves, [])
      await page.screenshot({ path: '/tmp/idle-buy-wall-broken.png' })
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
    // 다섯 칸 (587번): 돌파·성장·고양이·무기·스킬·상점. 좁은 화면에서도 글자가 칸을 넘지 않는다.
    await expect(nav.getByRole('button')).toHaveCount(5)
    assert.deepEqual(
      await nav
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent),
        ),
      [],
      'menu labels fit their tabs',
    )
    // 글자가 두 줄로 꺾이지 않는다: 다섯 칸의 글자 높이가 모두 같다.
    assert.equal(
      new Set(
        await nav
          .locator('button > span')
          .evaluateAll((labels) => labels.map((l) => Math.round(l.getBoundingClientRect().height))),
      ).size,
      1,
      'menu labels stay on one line',
    )
    // 환생 아이콘은 안내창만 열며 실제 환생 확인을 건너뛰지 않는다.
    const rebirthShortcut = page.getByTestId('rebirth-shortcut')
    await expect(rebirthShortcut).toBeVisible()
    await expect(rebirthShortcut.locator('img')).toHaveJSProperty('complete', true)
    await rebirthShortcut.click()
    await expect(page.getByTestId('rebirth')).toBeVisible()
    await expect(page.getByTestId('rebirth-confirm')).toHaveCount(0)
    await page.getByTestId('idle-menu').getByRole('button', { name: '닫기 ✕' }).click()
    await expect(rebirthShortcut).toBeFocused()
    // 고유 스킬 (587번): 장착한 셋이 전투 화면 오른쪽에 선다. 광고 스킬 (588번)은 왼쪽에 늘 셋이다.
    await expect(page.getByTestId('idle-active')).toHaveCount(3)
    await expect(page.getByTestId('idle-ad-active')).toHaveCount(3)
    {
      const left = await page.getByTestId('idle-ad-actives').boundingBox()
      const right = await page.getByTestId('idle-actives').boundingBox()
      assert(left && right && left.x + left.width < right.x, 'ad skills left, unique skills right')
      assert(left.x >= 0 && right.x + right.width <= width, 'skill buttons stay on screen')
      // 환생 단추는 광고 스킬 바로 위에 선다 (605번): 같은 줄에 맞추고 겹치지 않는다.
      const rebirth = await rebirthShortcut.boundingBox()
      assert(rebirth, 'rebirth shortcut is on screen')
      assert(Math.abs(rebirth.x - left.x) < 2, 'rebirth sits in the ad skill column')
      const gap = left.y - (rebirth.y + rebirth.height)
      assert(gap >= 0 && gap <= 12, `rebirth is right above the ad skills: ${gap}`)
    }
    // 광고 스킬은 아직 광고 없이 바로 눌린다 (586·588번): 광고를 본 것으로 쓰고, 남은 시간은 숫자 없이 원형 음영으로 보인다.
    const boost = page.locator('[data-testid=idle-ad-active][data-code=boostDamage]')
    await expect(boost).toBeEnabled()
    await expect(boost).toHaveAccessibleName(/공격력 3배.*광고 보고 3분 사용/)
    await expect(boost).toContainText('×3')
    await expect(boost.locator('.active-badge')).toBeVisible()
    await boost.click()
    // The banner is not checked here: a monster raid's notice uses the same strip and may replace it.
    await expect.poll(() => usedActives).toEqual([{ code: 'boostDamage', ad: true }])
    await expect(boost).toHaveAccessibleName('공격력 3배 · 180초 남았어요')
    await expect(boost).not.toContainText('180s')
    await expect(boost.locator('.idle-active-shade')).toBeVisible()
    await expect(boost).toHaveCSS('border-radius', '50%')
    const boostSize = await boost.boundingBox()
    assert(boostSize && boostSize.width === 48 && boostSize.height === 48, 'compact round skill')
    await expect(boost).toBeDisabled()
    await expect(page.locator('[data-testid=idle-ad-active][data-code=boostFire]')).toBeDisabled()
    await expect(page.locator('[data-testid=idle-ad-active][data-code=boostBuy]')).toBeDisabled()
    await page.screenshot({ path: `/tmp/idle-actives-${width}.png` })
    // 스킬 탭 (587번): 장착 칸 셋과 스킬 목록. 빼면 전투 화면의 단추가 사라지고, 다시 장착하면 돌아온다.
    await nav.getByRole('button', { name: '스킬', exact: true }).click()
    await expect(page.getByTestId('skills')).toBeVisible()
    await expect(page.getByTestId('skill-slot')).toHaveCount(3)
    await expect(page.getByTestId('unique-skill')).toHaveCount(6)
    await expect(page.getByTestId('ad-skill')).toHaveCount(0)
    await expect(page.getByTestId('skills').getByText('광고 스킬', { exact: true })).toHaveCount(0)
    const rally = page.locator('[data-testid=unique-skill][data-code=rally]')
    await expect(rally.getByRole('img', { name: /불장/ })).toBeVisible()
    await expect(rally).toContainText('×2')
    await rally.locator('summary[aria-label="불장 설명"]').click()
    await expect(rally.getByRole('img', { name: '지속 7초 · 재사용 대기 60초' })).toBeVisible()
    await expect(rally.locator('details')).toHaveAttribute('open', '')
    await expect(
      rally.getByText('사장냥과 고양이의 총이 두 배 빨리 나가요.', { exact: true }),
    ).toBeVisible()
    await rally.locator('summary[aria-label="불장 설명"]').click()
    await page.screenshot({ path: `/tmp/idle-skills-${width}.png` })
    await page
      .locator('[data-testid=skill-slot][data-code=rally]')
      .getByRole('button', { name: '불장 해제' })
      .click()
    await expect(rally).toHaveAttribute('data-equipped', 'false')
    assert.deepEqual(equips, [{ code: 'rally', equipped: false }])
    await expect(page.locator('[data-testid=skill-slot][data-code]')).toHaveCount(2)
    await expect(page.locator('[data-testid=skill-slot]:not([data-code])')).toHaveText('빈 칸')
    await expect(page.getByTestId('idle-active')).toHaveCount(2)
    await expect(page.locator('[data-testid=idle-active][data-code=rally]')).toHaveCount(0)
    await expect(page.getByTestId('idle-ad-active')).toHaveCount(3)
    await rally.getByTestId('skill-equip').click()
    await expect(rally).toHaveAttribute('data-equipped', 'true')
    assert.deepEqual(equips.at(-1), { code: 'rally', equipped: true })
    await expect(page.getByTestId('idle-active')).toHaveCount(3)
    // 상한가·손절·물타기 (591번): 칸이 꽉 차 있으면 장착하지 못하고, 하나를 빼면 그 자리에 장착해 전투 화면에 단추가 선다.
    const stopLoss = page.locator('[data-testid=unique-skill][data-code=stopLoss]')
    await expect(stopLoss).toContainText('손절')
    await stopLoss.locator('summary').click()
    await expect(stopLoss.getByRole('img', { name: '바로 발동 · 재사용 대기 60초' })).toBeVisible()
    await stopLoss.locator('summary').click()
    await expect(stopLoss.getByTestId('skill-equip')).toBeDisabled()
    await expect(stopLoss.getByTestId('skill-equip')).toHaveText('장착')
    await expect(page.locator('[data-testid=unique-skill][data-code=limitUp]')).toContainText(
      '전부 치명타',
    )
    await expect(page.locator('[data-testid=unique-skill][data-code=averaging]')).toContainText(
      '물타기',
    )
    await rally.getByTestId('skill-equip').click()
    await stopLoss.getByTestId('skill-equip').click()
    await expect(stopLoss).toHaveAttribute('data-equipped', 'true')
    assert.deepEqual(equips.at(-1), { code: 'stopLoss', equipped: true })
    await expect(
      page.locator('[data-testid=idle-active][data-code=stopLoss]'),
    ).toHaveAccessibleName(/손절/)
    await expect(page.locator('[data-testid=idle-active][data-code=stopLoss]')).toContainText(
      '−50%',
    )
    await page.screenshot({ path: `/tmp/idle-skills-new-${width}.png` })
    await stopLoss.getByTestId('skill-equip').click()
    await rally.getByTestId('skill-equip').click()
    await expect(page.locator('[data-testid=idle-active][data-code=rally]')).toHaveCount(1)
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    await expect(page.getByTestId('idle-menu')).toHaveCount(0)
    await expect(nav.getByRole('button', { name: /^무기/ })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '돌파', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const name of [/^성장/, CAT_MENU, '스킬', SHOP_MENU]) {
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
    'PASS: main view, heartbeat, background stop/resume, skill gating, five tabs, 320/390/1024px',
  )
} finally {
  await browser.close()
}
