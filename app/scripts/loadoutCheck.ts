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
          // 출전 칸의 번호 (599번).
          slot: (i < 4 ? i : null) as number | null,
          skills: [{ code: 'meteor', name: '메테오' }],
          skillLevel: 1,
          skillNextLevel: 20,
          grade: 'C',
          weapon: null as { kind: string; grade: string } | null,
        })),
      },
    }
    const mutations: { path: string; body: Record<string, string | boolean | number> }[] = []
    let reject = false
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      const body = route.request().postDataJSON()
      if (/\/(field|weapon|equip|merge)$/.test(path)) {
        mutations.push({ path, body })
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (reject) {
          await route.fulfill({
            status: 409,
            json: { message: '출전 구성이 바뀌었어요. 다시 골라 주세요' },
          })
          return
        }
      }
      if (path.endsWith('/cat/field')) {
        // 서버 IdleEngine.fieldCat처럼 칸을 지킨다 (599번).
        const me = required(company.idle.cats.find((c) => c.code === body.code))
        if (body.replaceCode) {
          const out = required(company.idle.cats.find((c) => c.code === body.replaceCode))
          Object.assign(me, { fielded: true, slot: out.slot })
          Object.assign(out, { fielded: false, slot: null })
        } else if (body.slot != null) {
          const there = company.idle.cats.find((c) => c.fielded && c.slot === body.slot)
          if (there && me.fielded) there.slot = me.slot
          else if (there) Object.assign(there, { fielded: false, slot: null })
          Object.assign(me, { fielded: true, slot: body.slot })
        } else {
          const taken = company.idle.cats.filter((c) => c.fielded).map((c) => c.slot)
          me.fielded = body.fielded
          me.slot = body.fielded ? ([0, 1, 2, 3].find((at) => !taken.includes(at)) ?? null) : null
        }
      }
      if (path.endsWith('/cat/weapon'))
        required(company.idle.cats.find((c) => c.code === body.code)).weapon = body.kind
          ? { kind: body.kind, grade: body.grade }
          : null
      // The boss cat's weapon (585): an empty body takes it off, a weapon puts it on.
      if (path.endsWith('/company/weapon'))
        for (const weapon of company.weapons)
          weapon.equipped = weapon.kind === body.kind && weapon.grade === body.grade
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
    const canvas = page.locator('[data-testid=idle-canvas] canvas')
    const originalCanvas = required(await canvas.elementHandle())
    const viewport = async () => {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      return canvas.evaluate((node: HTMLCanvasElement) => {
        const { x, y, width, height } = node.getBoundingClientRect()
        return { x, y, width, height, bitmapWidth: node.width, bitmapHeight: node.height }
      })
    }
    const battleViewport = await viewport()
    const expectStableBattle = async () => {
      assert.deepEqual(
        await viewport(),
        battleViewport,
        'opening a panel must preserve battle viewport',
      )
      assert(
        await originalCanvas.evaluate((node) => node.isConnected),
        'battle canvas stays mounted',
      )
    }
    // Cats and weapons share one tab (560).
    const CAT_MENU = /^출전( 합칠 수 있는 무기 있음)?$/
    for (const name of [CAT_MENU]) {
      await page.getByRole('button', { name }).last().click()
      await expectStableBattle()
      await page.getByRole('button', { name: '닫기 ✕', exact: true }).click()
      await expectStableBattle()
    }
    await page.getByRole('button', { name: CAT_MENU }).click()
    const tray = page.getByTestId('idle-menu')
    // The cat tab fills the screen (567): it reaches the top and ends at the bottom menu.
    const trayBox = required(await tray.boundingBox())
    assert(trayBox.y < 60 && trayBox.height > 600, 'cat tab fills the screen')
    const catsTab = tray.getByRole('tab', { name: '고양이', exact: true })
    const weaponsTab = tray.getByRole('tab', { name: '무기', exact: true })
    await expect(catsTab).toHaveAttribute('aria-selected', 'true')
    await weaponsTab.click()
    await expect(weaponsTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('cat-gear')).toBeVisible()
    await catsTab.click()
    await expect(catsTab).toHaveAttribute('aria-selected', 'true')
    await expect(tray.locator('.idle-cat-grid')).toBeVisible()
    // Two rows of five: a cat row and a weapon row, with no names in the slots.
    await expect(page.locator('.idle-cat-field-row > li')).toHaveCount(5)
    await expect(page.getByTestId('gun-slot')).toHaveCount(5)
    await expect(page.locator('.idle-cat-slot-name')).toHaveCount(0)
    const slotCat = required(await page.locator('[data-testid=cat-slot]').first().boundingBox())
    const slotGun = required(
      await page.locator('[data-testid=gun-slot]:not([data-code=boss])').first().boundingBox(),
    )
    assert(
      Math.abs(slotCat.x - slotGun.x) < 2 && slotGun.y > slotCat.y,
      'weapon sits under its cat',
    )
    const cat = (code: string) => page.locator(`[data-testid=cat][data-code=${code}]`)
    const target = (code: string) => page.locator(`[data-loadout-target="${code}"]`)
    const drag = async (
      from: ReturnType<typeof target>,
      to: ReturnType<typeof target>,
      touch = false,
    ) => {
      await expect(from).toBeEnabled()
      await from.scrollIntoViewIfNeeded()
      const f = required(await from.boundingBox()),
        t = required(await to.boundingBox())
      if (touch) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: f.x + f.width / 2, y: f.y + f.height / 2 }],
        })
        await expect(page.locator('.idle-gear-ghost, .reward-grab.is-grabbed')).toBeVisible()
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
    // Touch picks a cat up at once when it moves sideways: no long press. Up and down is the
    // list's scroll, so that does not pick it up.
    {
      await cat('snow').scrollIntoViewIfNeeded()
      const s = required(await cat('snow').boundingBox())
      const [x, y] = [Math.round(s.x + s.width / 2), Math.round(s.y + s.height / 2)]
      const cdp = await page.context().newCDPSession(page)
      const touch = (type: 'touchStart' | 'touchMove', tx: number, ty: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: tx, y: ty }] })
      const end = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch('touchStart', x, y)
      await touch('touchMove', x + 30, y)
      await expect(page.locator('.idle-gear-ghost')).toBeVisible({ timeout: 100 })
      await end()
      await expect(page.locator('.idle-gear-ghost')).toHaveCount(0)
      await touch('touchStart', x, y)
      await touch('touchMove', x, y - 30)
      await page.waitForTimeout(300)
      await expect(page.locator('.idle-gear-ghost')).toHaveCount(0)
      await end()
      await cdp.detach()
      assert.equal(mutations.length, 1)
    }
    // Cancellation outside all targets makes no request.
    await cat('snow').scrollIntoViewIfNeeded()
    const f = required(await cat('snow').boundingBox())
    await page.mouse.move(f.x + 12, f.y + 12)
    await page.mouse.down()
    await page.mouse.move(4, 90, { steps: 6 })
    await page.mouse.up()
    assert.equal(mutations.length, 1)
    // 출전 중인 고양이를 다른 칸에 놓으면 그 칸 번호로 옮기고, 둘이 자리를 맞바꾼다 (599번).
    const slotOrder = () =>
      page
        .locator('[data-testid=cat-slot]')
        .evaluateAll((slots) => slots.map((slot) => (slot as HTMLElement).dataset.code ?? null))
    assert.deepEqual(await slotOrder(), ['night', 'mint', 'lilac', 'sunset'])
    await drag(target('slot:mint'), target('slot:lilac'))
    await expect.poll(slotOrder).toEqual(['night', 'lilac', 'mint', 'sunset'])
    assert.deepEqual(mutations[1].body, { code: 'mint', fielded: true, slot: 2 })
    // 터치로는 꾹 눌러 집은 뒤 끌어 놓는다 (604번): 누르고만 있어도 집힌다.
    await drag(target('slot:mint'), target('slot:lilac'), true)
    await expect.poll(slotOrder).toEqual(['night', 'mint', 'lilac', 'sunset'])
    assert.deepEqual(mutations[2].body, { code: 'mint', fielded: true, slot: 1 })
    mutations.splice(1)
    // A full team (#910): the benched cat's button is "교체", not a disabled "칸 없음". It asks which
    // fielded cat leaves, and the swap is one request.
    await cat('sky').click()
    await expect(page.getByTestId('cat-field')).toHaveCount(0)
    const swap = page.getByTestId('cat-swap')
    await expect(swap).toHaveText('교체')
    await swap.click()
    await expect(page.getByTestId('swap-hint')).toContainText('하늘냥 대신 뺄 고양이')
    await expect(page.locator('[data-testid=cat-slot].is-drop-ready')).toHaveCount(4)
    await expect(swap).toHaveText('취소')
    await swap.click()
    await expect(page.getByTestId('swap-hint')).toHaveCount(0)
    // The boss cat cannot leave: picking it ends the swap with no request, and it does not resume.
    await swap.click()
    await page.getByTestId('cat-boss').click()
    await expect(page.getByTestId('swap-hint')).toHaveCount(0)
    await cat('sky').click()
    await expect(page.getByTestId('swap-hint')).toHaveCount(0)
    assert.equal(mutations.length, 1)
    await swap.click()
    await target('slot:sunset').click()
    await expect(page.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('swap-hint')).toHaveCount(0)
    assert.deepEqual(mutations[1].body, { code: 'sky', fielded: true, replaceCode: 'sunset' })
    assert.equal(mutations.length, 2)
    await expect.poll(slotOrder).toEqual(['night', 'mint', 'lilac', 'sky'])
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    mutations.splice(1)
    // Keyboard-equivalent tap selection + slot works and server rejection preserves the team.
    await cat('snow').click()
    reject = true
    await target('slot:mint').click()
    await expect(page.getByRole('alert').last()).toContainText('출전 구성이 바뀌었어요')
    assert.equal(required(company.idle.cats.find((c) => c.code === 'mint')).fielded, true)
    reject = false
    await target('slot:mint').click()
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'snow')
    await expect(page.getByTestId('cat-field')).toHaveAttribute('aria-pressed', 'true')
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
    // Unequip (575): the held weapon is picked up from its slot and dropped below. A touch that
    // moves straight down picks it up at once, and the cat is back to the default pistol.
    {
      const slot = page.locator('[data-testid=gun-slot][data-code=night]')
      await expect(slot).toHaveAttribute('data-kind', 'rifle')
      const from = required(await slot.boundingBox())
      const to = required(await page.getByTestId('cat-detail').boundingBox())
      const [x, y] = [Math.round(from.x + from.width / 2), Math.round(from.y + from.height / 2)]
      const cdp = await page.context().newCDPSession(page)
      const touch = (type: 'touchStart' | 'touchMove', tx: number, ty: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: tx, y: ty }] })
      const before = mutations.length
      await touch('touchStart', x, y)
      await touch('touchMove', x, y + 20)
      await expect(page.getByTestId('unequip-hint')).toBeVisible({ timeout: 100 })
      await touch('touchMove', Math.round(to.x + to.width / 2), Math.round(to.y + to.height / 2))
      await expect(page.getByTestId('unequip-hint')).toHaveText('놓으면 무기를 빼요')
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
      await expect(slot).toHaveClass(/is-bare/)
      assert.equal(required(company.idle.cats.find((c) => c.code === 'night')).weapon, null)
      assert.deepEqual(mutations.at(-1)?.body, { code: 'night' })
      assert.equal(mutations.length, before + 1)
      // Dropped back on the slots it does nothing; a tap still opens that cat's gear.
      await drag(freeGun(), target('wearer:night'))
      await expect(slot).toHaveAttribute('data-kind', 'rifle')
      const again = mutations.length
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 40, y, { steps: 4 })
      await page.mouse.up()
      assert.equal(mutations.length, again)
      await expect(page.getByTestId('unequip-hint')).toHaveCount(0)
      // The click a drop itself makes is swallowed; a later tap is not.
      await page.waitForTimeout(150)
    }
    // The boss cat's weapon comes off the same way (585): dragged from its slot and dropped below.
    // The boss cat then shoots the default pistol. It still cannot leave the field.
    {
      const slot = page.locator('[data-testid=gun-slot][data-code=boss]')
      await expect(slot).not.toHaveClass(/is-bare/)
      const before = mutations.length
      await drag(slot, page.getByTestId('cat-detail'))
      await expect(slot).toHaveClass(/is-bare/)
      assert.deepEqual(mutations.at(-1), { path: '/api/company/weapon', body: {} })
      assert.equal(mutations.length, before + 1)
      assert.equal(
        company.weapons.some((w) => w.equipped),
        false,
      )
      await expect(slot).toHaveAttribute('aria-label', /사장냥의 무기 기본 권총/)
      // A bare slot cannot be picked up again.
      await drag(slot, page.getByTestId('cat-detail'))
      assert.equal(mutations.length, before + 1)
      await page.waitForTimeout(150)
      // The button in the boss cat's gear list does the same.
      await drag(
        page.locator('[data-testid=cat-weapon][data-kind=pistol][data-grade=F]').first(),
        target('wearer:boss'),
      )
      await expect(slot).not.toHaveClass(/is-bare/)
      await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'boss')
      await page.getByTestId('cat-unequip').click()
      await expect(slot).toHaveClass(/is-bare/)
      await expect(page.getByTestId('cat-unequip')).toHaveCount(0)
      await expect(page.getByTestId('cat-boss')).toHaveAttribute('aria-label', /출전 중/)
      await expect(page.getByTestId('cat-field')).toHaveCount(0)
      // Put the pistol back for the rest of the check.
      await drag(
        page.locator('[data-testid=cat-weapon][data-kind=pistol][data-grade=F]').first(),
        target('wearer:boss'),
      )
      await expect(slot).not.toHaveClass(/is-bare/)
      await page.waitForTimeout(150)
    }
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
    // The equipped reward lands on the wearer's equipment list inside the cat tab.
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'lilac')
    await expect(page.getByTestId('cat-gear')).toBeVisible()
    await page.getByRole('button', { name: CAT_MENU }).last().click()
    await expect(page.getByTestId('cat-detail')).toHaveAttribute('data-code', 'lilac')
    await expect(page.getByTestId('cat-gear')).toHaveCount(0)
    await page.screenshot({ path: `/tmp/loadout-${width}.png`, fullPage: true })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    // A late equip response updates the game, but must not pull the user out of the shop.
    await page.getByTestId('cat-gun').click()
    await page.locator('[data-testid=cat-weapon][data-grade=D]').click()
    const equipped = page.waitForResponse((response) => response.url().endsWith('/cat/weapon'))
    await page.getByTestId('gear-equip').click()
    await page.getByRole('button', { name: /^상점/ }).last().click()
    await equipped
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
    await expect(page.getByTestId('cat-gacha')).toBeVisible()
    await expect(page.getByTestId('cat-detail')).toHaveCount(0)
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${width}px: touch swap/equip, mouse merge, cancel, rejection, tap fallback, reward equip, persistent selection`,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
