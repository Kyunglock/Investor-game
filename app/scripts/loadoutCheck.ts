import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

function required<T>(value: T | null | undefined): T {
  assert(value !== null && value !== undefined)
  return value
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const company = {
      ...structuredClone(fixture),
      weapons: [
        {
          kind: 'pistol',
          name: '권총',
          grade: 'F',
          gradeName: 'F',
          damagePercent: 100,
          fireMs: 260,
          power: 0,
          bulletSpeed: 720,
          equipped: true,
          count: 1,
        },
        {
          kind: 'rifle',
          name: '소총',
          grade: 'E',
          gradeName: 'E',
          damagePercent: 200,
          fireMs: 200,
          power: 0,
          bulletSpeed: 800,
          equipped: false,
          count: 4,
        },
      ],
      armory: { mergeCount: 2, lastDraw: null as object | null, lastDraws: [] },
      idle: {
        wall: 1,
        hp: 1200,
        maxHp: 1200,
        dps: 12,
        earned: 0,
        boss: false,
        circuitSeconds: 0,
        sequence: 0,
        upcoming: [],
        fieldSlots: 4,
        wallDps: 0,
        power: 1038,
        offline: null,
        income: { perSecond: 100, staffPerSecond: 100, bonusPercent: 0 },
        skills: [{ code: 'meteor', name: '메테오', owned: true, level: 1 }],
        cats: ['sky', 'mint', 'lilac', 'sunset', 'night', 'snow'].map((code, i) => ({
          code,
          name: ['하늘냥', '민트냥', '라일락냥', '노을냥', '밤냥', '눈꽃냥'][i],
          level: 12,
          damagePercent: 50,
          firePercent: 100,
          criticalPercent: 100,
          fielded: i < 4,
          skill: 'meteor',
          skillName: '메테오',
          skillLevel: 1,
          skillNextLevel: 20,
          grade: 'C',
          weapon: null as { kind: string; grade: string } | null,
        })),
      },
    }
    const mutations: { path: string; body: Record<string, string | boolean> }[] = []
    let reject = false
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      const body = route.request().postDataJSON()
      if (/\/(field|weapon|equip|merge)$/.test(path)) {
        mutations.push({ path, body })
        if (reject) {
          await route.fulfill({
            status: 409,
            json: { message: '출전 구성이 바뀌었어요. 다시 골라 주세요' },
          })
          return
        }
      }
      if (path.endsWith('/cat/field')) {
        if (body.replaceCode)
          required(company.idle.cats.find((c) => c.code === body.replaceCode)).fielded = false
        required(company.idle.cats.find((c) => c.code === body.code)).fielded = body.fielded
      }
      if (path.endsWith('/cat/weapon'))
        required(company.idle.cats.find((c) => c.code === body.code)).weapon = body.kind
          ? { kind: body.kind, grade: body.grade }
          : null
      if (path.endsWith('/weapon/merge')) {
        company.weapons[1].count -= 2
        company.weapons.push({ ...company.weapons[1], grade: 'D', gradeName: 'D', count: 1 })
      }
      if (path.endsWith('/weapon/draw')) {
        company.weapons[1].count++
        company.armory.lastDraw = {
          kind: 'rifle',
          name: '소총',
          grade: 'E',
          gradeName: 'E',
          isNew: false,
        }
      }
      await route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL || 'http://localhost:5182/app/')
    await expect(page.getByTestId('idle-battle')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: '고양이', exact: true }).click()
    const tray = page.getByTestId('idle-menu')
    assert(required(await tray.boundingBox()).y > 200, 'battle remains visible above tray')
    const cat = (code: string) => page.locator(`[data-testid=cat][data-code=${code}]`)
    const target = (code: string) => page.locator(`[data-loadout-target="${code}"]`)
    const drag = async (
      from: ReturnType<typeof target>,
      to: ReturnType<typeof target>,
      touch = false,
    ) => {
      await from.scrollIntoViewIfNeeded()
      const f = required(await from.boundingBox()),
        t = required(await to.boundingBox())
      if (touch) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: f.x + f.width / 2, y: f.y + f.height / 2 }],
        })
        await page.waitForTimeout(330)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: t.x + t.width / 2, y: t.y + t.height / 2 }],
        })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await cdp.detach()
      } else {
        await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
        await page.mouse.down()
        await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
        await page.mouse.up()
      }
    }
    // Touch replacement is one request, with no intermediate unfield request.
    await drag(cat('night'), target('slot:sky'), true)
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'night')
    assert.deepEqual(mutations[0].body, { code: 'night', fielded: true, replaceCode: 'sky' })
    assert.equal(company.idle.cats.filter((c) => c.fielded).length, 4)
    // Cancellation outside all targets makes no request.
    await cat('snow').scrollIntoViewIfNeeded()
    const f = required(await cat('snow').boundingBox())
    await page.mouse.move(f.x + 12, f.y + 12)
    await page.mouse.down()
    await page.mouse.move(4, 90, { steps: 6 })
    await page.mouse.up()
    assert.equal(mutations.length, 1)
    // Keyboard-equivalent tap selection + slot works and server rejection preserves the team.
    await cat('snow').click()
    reject = true
    await target('slot:mint').click()
    await expect(page.getByRole('alert').last()).toContainText('출전 구성이 바뀌었어요')
    assert.equal(required(company.idle.cats.find((c) => c.code === 'mint')).fielded, true)
    reject = false
    await target('slot:mint').click()
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'snow')
    // Inline equipment retains the selected cat, including one that was previously on the bench.
    await page.getByTestId('cat-gun').click()
    const freeGun = () =>
      page
        .locator('[data-testid=cat-weapon][data-kind=rifle][data-grade=E]:not([data-holder])')
        .first()
    await drag(freeGun(), target('wearer:night'), true)
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'night')
    assert.deepEqual(required(company.idle.cats.find((c) => c.code === 'night')).weapon, {
      kind: 'rifle',
      grade: 'E',
    })
    // Tap compares; the confirmation button is the only mutation.
    await target('wearer:snow').click()
    const before = mutations.length
    await freeGun().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('gear-compare')).toBeVisible()
    assert.equal(mutations.length, before)
    await page.getByTestId('gear-equip').click()
    await expect(page.locator('[data-testid=cat-weapon][data-holder=snow]')).toBeVisible()
    // Two free copies merge. Equipped copies remain untouched.
    const free = page.locator(
      '[data-testid=cat-weapon][data-kind=rifle][data-grade=E]:not([data-holder])',
    )
    await drag(free.nth(0), free.nth(1))
    await expect(page.getByTestId('merge-result')).toHaveAttribute('data-grade', 'D')
    assert.equal(company.weapons[1].count, 2)
    assert.deepEqual(required(company.idle.cats.find((c) => c.code === 'snow')).weapon, {
      kind: 'rifle',
      grade: 'E',
    })
    // Selected cat survives menu switches; reward is equipped directly from its result.
    await page.getByRole('button', { name: /^상점/ }).last().click()
    await page.getByTestId('draw-kind-weapon').click()
    await page.getByTestId('weapon-draw').click()
    await expect(page.getByTestId('reward-grab')).toBeVisible()
    await drag(page.getByTestId('reward-grab'), target('reward:lilac'), true)
    await expect(page.getByTestId('weapon-reveal')).toHaveCount(0)
    await expect(page.getByTestId('weapon-now')).toContainText('라일락냥')
    await page.getByRole('button', { name: '고양이', exact: true }).last().click()
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'lilac')
    await page.screenshot({ path: `/tmp/loadout-${width}.png`, fullPage: true })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${width}px: touch swap/equip, mouse merge, cancel, rejection, tap fallback, reward equip, persistent selection`,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
