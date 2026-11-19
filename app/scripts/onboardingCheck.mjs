import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'
import { checkRevealViewport } from './revealViewportCheck.mjs'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const c = structuredClone(fixture)
    c.idle = {
      wall: 1,
      hp: 1200,
      maxHp: 1200,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      cleared: 0,
      upcoming: [],
      skills: [],
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
      activeSlots: 3,
      actives: [
        {
          code: 'barrage',
          name: '매수세례',
          equipped: true,
          ad: false,
          readyIn: 0,
          left: 0,
          cooldown: 40,
          seconds: 0,
        },
      ],
      cats: [
        {
          code: 'night',
          name: '밤냥',
          grade: 'A',
          level: 0,
          damagePercent: 100,
          firePercent: 100,
          criticalPercent: 100,
          fielded: false,
          skills: [{ code: 'meteor', name: '메테오' }],
          skillLevel: 1,
          skillNextLevel: 10,
          weapon: null,
        },
      ],
      onboarding: {
        step: -1,
        catClaimed: false,
        weaponClaimed: false,
        skillsUnlocked: false,
        skillGuideSeen: false,
      },
    }
    c.battleUpgrades = [
      {
        kind: 'damage',
        level: 0,
        price: 1,
        damagePercent: 0,
        bonusPercent: 0,
        priceGrowthPercent: 4,
        maxLevel: 0,
      },
    ]
    c.weapons = [
      {
        kind: 'pistol',
        grade: 'F',
        name: '권총',
        gradeName: 'F',
        count: 1,
        equipped: true,
        damagePercent: 100,
        fireMs: 260,
        power: 1,
        bulletSpeed: 720,
      },
    ]
    c.armory = { mergeCount: 2, lastDraw: null, lastDraws: [] }
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const url = route.request().url()
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      const p = c.idle.onboarding
      if (url.endsWith('/idle/tutorial')) {
        if (['next', 'draw-cat', 'draw-weapon'].includes(body.action)) {
          assert.equal(body.step, p.step)
          if (p.step === 2) {
            assert.equal(body.action, 'draw-cat')
            p.catClaimed = true
            c.idle.cats[0].level = 1
          }
          if (p.step === 4) {
            assert.equal(body.action, 'draw-weapon')
            p.weaponClaimed = true
            c.weapons.push({
              ...c.weapons[0],
              kind: 'smg',
              grade: 'B',
              gradeName: 'B',
              name: '기관단총',
              equipped: false,
            })
          }
          if (p.step === 4) c.armory.lastDraw = { ...c.weapons[1], isNew: true }
          p.step++
        } else if (body.action === 'skills') p.skillGuideSeen = true
        else if (body.action === 'start') p.step = -1
        else assert.fail('unexpected tutorial action')
      }
      if (url.includes('/battle-upgrade')) c.battleUpgrades[0].level = 1
      if (url.endsWith('/cat/field')) c.idle.cats[0].fielded = body.fielded
      if (url.endsWith('/cat/weapon')) c.idle.cats[0].weapon = c.weapons[1]
      await route.fulfill({ json: c })
    })
    const refresh = async () => {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('loading')).toHaveCount(0, { timeout: 30000 })
    }
    page.setDefaultTimeout(12000)
    page.setDefaultNavigationTimeout(15000)
    await page.goto(process.env.APP_URL ?? 'http://localhost:5187/app/', {
      waitUntil: 'domcontentloaded',
    })
    const drag = async (from, to) => {
      await from.scrollIntoViewIfNeeded()
      const f = await from.boundingBox(),
        t = await to.boundingBox()
      assert.ok(f && t)
      if (width === 320) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: f.x + f.width / 2, y: f.y + f.height / 2 }],
        })
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: t.x + t.width / 2, y: t.y + t.height / 2 }],
        })
        await expect(page.locator('.idle-gear-ghost')).toBeVisible()
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await cdp.detach()
      } else {
        await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
        await page.mouse.down()
        await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
        await page.mouse.up()
      }
    }
    const guide = page.getByTestId('idle-tutorial')
    await expect(guide).toHaveAttribute('data-step', '-1')
    await expect(guide).toContainText('환영해요')
    await expect(guide.getByRole('button', { name: '건너뛰기' })).toHaveCount(0)
    if (width === 390) {
      c.idle.wall = 2
      c.idle.cleared = 1
    }
    await guide.getByRole('button', { name: '함께 시작하기' }).click()
    await expect(guide).toHaveAttribute('data-step', '0')
    await expect(page.getByRole('button', { name: '성장', exact: false }).first()).toBeDisabled()
    await expect(page.getByTestId('idle-active')).toHaveCount(0)
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    await expect(page.getByTestId('loading')).toHaveCount(0, { timeout: 30000 })
    const shade = page.locator('.tutorial-shade')
    const windows = shade.locator('.tutorial-focus rect')
    await expect(shade).toBeVisible()
    await expect(shade).toHaveCSS('pointer-events', 'none')
    const checkWindow = async (window, target) => {
      await expect
        .poll(async () => {
          const [box, hole] = await Promise.all([target.boundingBox(), window.boundingBox()])
          if (!box || !hole) return false
          const x = box.x + box.width / 2
          const y = box.y + box.height / 2
          return hole.x <= x && x <= hole.x + hole.width && hole.y <= y && y <= hole.y + hole.height
        })
        .toBe(true)
    }
    await expect(windows).toHaveCount(1)
    await checkWindow(windows.first(), page.getByTestId('idle-wall-number'))
    const canvas = page.getByTestId('idle-canvas')
    await expect(canvas).toHaveCSS('border-left-width', '0px')
    await expect(canvas).toHaveCSS('border-right-width', '0px')
    if (width === 320)
      await expect(guide.getByRole('button', { name: '첫 매도벽 돌파를 기다려요' })).toBeDisabled()
    await page.screenshot({ path: `/tmp/tutorial-existing-${width}.png` })
    c.idle.wall = 2
    c.idle.cleared = 1
    await refresh()
    await page.waitForTimeout(400)
    await expect(guide).toHaveAttribute('data-step', '0')
    await expect(guide).toContainText('첫 매도벽을 돌파했어요')
    await guide.getByRole('button', { name: '첫 돌파 확인했어요' }).click()
    await expect(guide).toHaveAttribute('data-step', '1')
    const nav = (name) => page.locator(`[data-tutorial-menu="${name}"]`).last()
    const target = guide
    const locked = async (step) => {
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-drag-lock', 'true')
      const sheet = page.getByTestId('idle-menu')
      const before = await sheet.evaluate((el) => el.scrollTop)
      await nav('growth').click()
      const settings = await page.getByTestId('idle-options').boundingBox()
      await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2)
      await expect(page.locator('.idle-options-panel')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(guide).toHaveAttribute('data-step', String(step))
      await expect(sheet).toBeVisible()
      await page.mouse.move(width / 2, 400)
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(150)
      assert.equal(await sheet.evaluate((el) => el.scrollTop), before)
      await page.keyboard.press('PageDown')
      await page.keyboard.press('Tab')
      assert.equal(await sheet.evaluate((el) => el.scrollTop), before)
    }
    await expect(target).toHaveAttribute('data-target', '[data-tutorial-menu="growth"]')
    await nav('growth').click()
    await expect(target).toHaveAttribute(
      'data-target',
      '[data-testid="idle-stat"][data-kind="damage"] .idle-buy',
    )
    await page.screenshot({ path: `/tmp/tutorial-focus-growth-${width}.png` })
    await page.locator('[data-testid=idle-stat][data-kind=damage] button').click()
    await expect(guide).toHaveAttribute('data-step', '2')
    await nav('shop').click()
    await expect(target).toHaveAttribute('data-target', '[data-testid="cat-draw"]')
    await expect(page.getByTestId('cat-draw')).toContainText('무료 1회 뽑기')
    await page.screenshot({ path: `/tmp/tutorial-shop-cat-${width}.png` })
    await page.getByTestId('cat-draw').click()
    await expect(page.getByTestId('cat-reveal')).toBeVisible()
    await expect(guide).toBeHidden()
    await expect(page.getByTestId('cat-drawn')).toContainText('밤냥')
    await checkRevealViewport(page, 'cat', true)
    await page.getByRole('button', { name: '밤냥 출전시키러 가기' }).click()
    await expect(guide).toHaveAttribute('data-step', '3')
    await expect(target).toHaveAttribute('data-target', '[data-testid="cat"][data-code="night"]')
    await expect(guide).toHaveAttribute('data-drop-target', '[data-loadout-target^="slot:empty"]')
    await expect(windows).toHaveCount(2)
    await checkWindow(windows.first(), page.locator('[data-testid=cat][data-code=night]'))
    await checkWindow(windows.last(), page.locator('[data-loadout-target="slot:empty0"]'))
    await locked(3)
    await page.screenshot({ path: `/tmp/tutorial-drag-cat-${width}.png` })
    await drag(
      page.locator('[data-testid=cat][data-code=night]'),
      page.locator('[data-loadout-target="slot:empty0"]'),
    )
    await expect(guide).toHaveAttribute('data-step', '4')
    await nav('shop').click()
    await page.getByTestId('draw-kind-weapon').click()
    await expect(page.getByTestId('weapon-draw')).toContainText('무료 1회 뽑기')
    await page.screenshot({ path: `/tmp/tutorial-shop-weapon-${width}.png` })
    await page.getByTestId('weapon-draw').click()
    await expect(page.getByTestId('weapon-reveal')).toBeVisible()
    await expect(guide).toBeHidden()
    await expect(page.getByTestId('weapon-drawn')).toContainText('기관단총')
    await checkRevealViewport(page, 'weapon', true)
    await page.getByRole('button', { name: '밤냥에게 무기 끌어놓기' }).click()
    await expect(guide).toHaveAttribute('data-step', '5')
    await refresh()
    await expect(guide).toHaveAttribute('data-step', '5')
    await nav('cats').click()
    await page.locator('[data-testid=gun-slot][data-code=night]').click()
    await expect(target).toHaveAttribute(
      'data-target',
      '[data-testid="cat-weapon"][data-grade="B"]:not([data-holder])',
    )
    await expect(guide).toHaveAttribute(
      'data-drop-target',
      '[data-testid="gun-slot"][data-code="night"]',
    )
    await locked(5)
    await page.screenshot({ path: `/tmp/tutorial-drag-weapon-${width}.png` })
    await drag(
      page.locator('[data-testid=cat-weapon][data-grade=B]:not([data-holder])'),
      page.locator('[data-testid=gun-slot][data-code=night]'),
    )
    await expect(guide).toHaveAttribute('data-step', '6')
    await expect(page.locator('body')).not.toHaveAttribute('data-tutorial-drag-lock', 'true')
    await guide.getByRole('button', { name: '메테오 확인했어요' }).click()
    await guide.getByRole('button', { name: '안내 마치기' }).click()
    await expect(guide).toHaveCount(0)
    await expect(shade).toHaveCount(0)
    await expect(nav('skills')).toBeDisabled()
    c.idle.wall = 101
    c.idle.onboarding.skillsUnlocked = true
    await refresh()
    await expect(guide).toContainText('100 매도벽 돌파!')
    await nav('skills').click()
    await guide.getByRole('button', { name: '사용 위치 보기' }).click()
    await nav('battle').click()
    await expect(target).toHaveAttribute('data-target', '[data-testid="idle-active"]')
    await page.getByTestId('idle-active').click()
    await expect(guide).toHaveCount(0)
    await page.getByTestId('idle-options').click()
    await page.getByRole('button', { name: '첫 출근 안내 다시 보기' }).click()
    await expect(guide).toContainText('다시 보기')
    await guide.getByRole('button', { name: '안내 닫기', exact: true }).click()
    assert.equal(c.idle.onboarding.step, 8)
    assert.equal(c.weapons.length, 2)
    c.idle.onboarding.catClaimed = false
    c.idle.onboarding.weaponClaimed = false
    await refresh()
    await expect(guide).toHaveCount(0)
    await page.getByTestId('idle-options').click()
    await page.getByRole('button', { name: '무료 첫 뽑기 안내 시작' }).click()
    await page.getByTestId('idle-options').click()
    await expect(guide).toContainText('환영해요')
    assert.equal(c.idle.onboarding.catClaimed, false)
    assert.equal(c.idle.onboarding.weaponClaimed, false)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('기존 UI 320/390px: 출전·장착·재접속·100벽 해금·다시 보기 통과')
} finally {
  await browser.close()
}
