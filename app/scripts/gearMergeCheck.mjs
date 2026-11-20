import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

// 고양이·무기 탭의 장비 목록 (decisions.md 530·560번, #791·#918): 누르면 비교하고 단추로 장착, 집어서 같은 무기 위로 끌면 합치기. 남이 든
// 무기는 못 고른다. 아무도 안 든 무기는 한 칸에 수로 묶고, 합칠 수 있을 때만 두 칸을 한 상자로 붙여 보인다.
// 서버 없이 가짜 API로 본다. 가짜 API는 서버와 같은 규칙으로 거절(400)하고, 화면이 한 번도 거절당하지 않는지 센다.
// SHOTS=폴더 를 주면 화면을 그 폴더에 찍는다.

const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SR', 'UR', 'LR']
const KINDS = {
  F: ['pistol', '권총'],
  E: ['pistol', '권총'],
  D: ['revolver', '리볼버'],
  C: ['smg', '기관단총'],
  S: ['rifle', '소총'],
  LR: ['rifle', '소총'],
}
const weapon = (grade, count, equipped = false) => ({
  kind: KINDS[grade][0],
  name: KINDS[grade][1],
  grade,
  gradeName: grade,
  damagePercent: 100 + GRADES.indexOf(grade) * 80,
  fireMs: 260,
  power: 0,
  bulletSpeed: 720,
  equipped,
  count,
})
const CATS = [
  ['sky', '하늘냥', 'meteor', '메테오 스킬'],
  ['mint', '민트냥', 'water', '물 스킬'],
  ['lilac', '라일락냥', 'bolt', '번개 스킬'],
  ['sunset', '노을냥', 'ram', '충차 스킬'],
  ['night', '밤냥', 'meteor', '메테오 스킬'],
  ['snow', '눈꽃냥', 'water', '물 스킬'],
]

function world() {
  const company = {
    ...structuredClone(fixture),
    diamonds: { ...fixture.diamonds, amount: 1200 },
    armory: { mergeCount: 2, lastDraw: null, lastDraws: [] },
    // 권총 F 넷(사장냥이 하나), 권총 E 둘(하늘냥이 하나), 리볼버 D 둘, 소총 S 하나(민트냥), 소총 LR 둘(가장 높은 등급).
    weapons: [
      weapon('F', 4, true),
      weapon('E', 2),
      weapon('D', 2),
      weapon('S', 1),
      weapon('LR', 2),
    ],
    battleUpgrades: ['damage', 'fire', 'hp'].map((kind, i) => ({
      kind,
      level: 3 + i,
      price: 1_000_000,
      priceGrowthPercent: 10,
      bonusPercent: 30 + i * 10,
      nextBonusPercent: 40 + i * 10,
      maxLevel: 0,
    })),
    idle: {
      wall: 12,
      hp: 900,
      maxHp: 1200,
      dps: 40,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      upcoming: [],
      skills: ['water', 'meteor', 'bolt', 'ram'].map((code) => ({
        code,
        name: CATS.find((c) => c[2] === code)[3],
        owned: true,
        level: 1,
      })),
      fieldSlots: 4,
      wallDps: 0,
      power: 1038,
      income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
      offline: null,
      lastDraws: [],
      cats: CATS.map(([code, name, skill, skillName], i) => ({
        code,
        name,
        // 눈꽃냥은 아직 없다. 밤냥은 스킬이 최고 레벨이다.
        level: code === 'snow' ? 0 : code === 'night' ? 9 : i + 1,
        damagePercent: 50 + i * 10,
        firePercent: 100,
        criticalPercent: 100,
        fielded: i < 3,
        skills: [{ code: skill, name: skillName }],
        skillLevel: code === 'night' ? 5 : Math.floor(i / 2) + 1,
        skillNextLevel: code === 'night' ? 0 : i + 2 + (i % 2),
        // 등급은 종마다 정해져 있다 (539번).
        grade: code === 'night' || code === 'snow' ? 'A' : 'C',
        weapon:
          code === 'sky'
            ? { kind: 'pistol', grade: 'E' }
            : code === 'mint'
              ? { kind: 'rifle', grade: 'S' }
              : null,
      })),
    },
  }
  const refused = []
  const calls = []
  const find = (kind, grade) => company.weapons.find((w) => w.kind === kind && w.grade === grade)
  /** 아무도 들지 않은 수 (서버 IdleEngine.free). except는 든 이로 치지 않는 고양이다. */
  const free = (w, except) =>
    w.count -
    (w.equipped ? 1 : 0) -
    company.idle.cats.filter(
      (c) => c.code !== except && c.weapon?.kind === w.kind && c.weapon.grade === w.grade,
    ).length
  const handle = (path, sent) => {
    if (path.endsWith('/cat/weapon')) {
      const cat = company.idle.cats.find((c) => c.code === sent.code)
      if (!sent.kind) cat.weapon = null
      else {
        const w = find(sent.kind, sent.grade)
        if (!w || free(w, cat.code) < 1) return '장착 중인 무기다. 같은 무기가 하나 더 있어야 한다'
        cat.weapon = { kind: sent.kind, grade: sent.grade }
      }
    } else if (path.endsWith('/cat/field')) {
      company.idle.cats.find((c) => c.code === sent.code).fielded = sent.fielded
    } else if (path.endsWith('/weapon/merge')) {
      const w = find(sent.kind, sent.grade)
      const at = GRADES.indexOf(sent.grade)
      if (!w || at === GRADES.length - 1) return '가장 높은 등급이라 더 합칠 수 없다'
      if (free(w) < company.armory.mergeCount) return '장착 중인 무기는 합칠 수 없다'
      w.count -= company.armory.mergeCount
      if (w.count === 0) company.weapons.splice(company.weapons.indexOf(w), 1)
      // 서버처럼 같은 종류의 한 등급 위 무기가 된다.
      const up = GRADES[at + 1]
      const made = find(w.kind, up)
      if (made) made.count++
      else company.weapons.push({ ...weapon(up, 1), kind: w.kind, name: w.name })
    } else if (path.endsWith('/weapon/merge-all')) {
      for (const grade of GRADES.slice(0, -1)) {
        const w = company.weapons.find((item) => item.grade === grade)
        if (!w) continue
        const batches = Math.floor(free(w) / company.armory.mergeCount)
        if (!batches) continue
        w.count -= batches * company.armory.mergeCount
        if (!w.count) company.weapons.splice(company.weapons.indexOf(w), 1)
        const up = GRADES[GRADES.indexOf(grade) + 1]
        const made = company.weapons.find((item) => item.grade === up)
        if (made) made.count += batches
        else company.weapons.push(weapon(up, batches))
      }
    } else if (path.endsWith('/company/weapon')) {
      const w = find(sent.kind, sent.grade)
      if (!w || (!w.equipped && free(w) < 1))
        return '장착 중인 무기다. 같은 무기가 하나 더 있어야 한다'
      for (const x of company.weapons) x.equipped = x === w
    }
    return null
  }
  const route = async (r) => {
    const request = r.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST' && !path.endsWith('/idle') && !path.endsWith('/sessions')) {
      const sent = request.postDataJSON() ?? {}
      calls.push(
        [path.replace('/api/company', ''), sent.code, sent.grade].filter(Boolean).join(' '),
      )
      const message = handle(path, sent)
      if (message) {
        refused.push(`${path}: ${message}`)
        return r.fulfill({ status: 400, json: { message } })
      }
    }
    return r.fulfill({ json: company })
  }
  return { company, refused, calls, route }
}

const shots = process.env.SHOTS
if (shots) mkdirSync(shots, { recursive: true })
const cell = (page, grade, holder) =>
  page.locator(
    `[data-testid=cat-weapon][data-grade="${grade}"]${holder ? `[data-holder=${holder}]` : ':not([data-holder])'}`,
  )
const center = async (locator) => {
  const box = await locator.boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
const CAT_MENU = /^고양이·무기( 합칠 수 있는 무기 있음)?$/
/** 누르면 비교가 뜨고, 그 단추를 눌러야 장착한다. */
const equip = async (page, locator) => {
  await locator.click()
  await page.getByTestId('gear-equip').click()
}
const noOverflow = async (page) =>
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    '가로로 넘치지 않는다',
  )

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    if (process.env.UI_WIDTH && Number(process.env.UI_WIDTH) !== width) continue
    // ── 마우스: 장착, 장착 중 표시, 끌어서 합치기 ─────────────────────────────
    {
      const { company, refused, calls, route } = world()
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      const shot = async (name) => {
        if (shots) await page.screenshot({ path: `${shots}/${width}-${name}.png` })
      }
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, route)
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')

      // 뽑기는 상점 탭에 있다 (541번): 고양이 뽑기와 무기 뽑기를 한 화면에서 고른다.
      await page.getByRole('button', { name: /^상점/ }).click()
      await expect(page.getByTestId('cat-draw')).toBeVisible()
      await expect(page.getByTestId('draw-kind-weapon')).toHaveText('무기 뽑기')
      await shot('draw-cat')
      await page.getByTestId('draw-kind-weapon').click()
      await expect(page.getByTestId('weapon-draw')).toContainText('다이아 100개')
      await expect(page.getByTestId('weapon-draw-ten')).toContainText('10회 뽑기')
      await expect(page.getByTestId('weapon-draw-ad')).toBeVisible()
      await expect(page.getByTestId('cat-draw')).toHaveCount(0)
      await shot('draw-weapon')
      await page.getByTestId('draw-kind-cat').click()

      // 고양이·무기 탭 (560번): 처음에는 사장냥이 골라져 있고 스킬 설명이 없다. 든 무기를 누르면 장비 목록이 펴진다.
      const tab = (name) =>
        page.getByRole('navigation', { name: '게임 메뉴' }).last().getByRole('button', { name })
      await tab(CAT_MENU).click()
      const detail = page.getByTestId('cat-detail')
      await expect(detail).toHaveAttribute('data-code', 'boss')
      await expect(detail.getByTestId('cat-skill')).toHaveCount(0)
      await detail.getByTestId('cat-gun').click()
      await expect(detail.getByTestId('cat-gun')).toContainText('권총')
      await expect(cell(page, 'F', 'boss')).toHaveAttribute('aria-pressed', 'true')
      // 하늘냥·민트냥이 든 것은 사장냥이 못 고른다.
      await expect(cell(page, 'E', 'sky')).toBeDisabled()
      await expect(cell(page, 'E', 'sky')).toContainText('장착 중')
      await expect(cell(page, 'E', 'sky')).toContainText('하늘냥')
      await expect(cell(page, 'S', 'mint')).toBeDisabled()
      // 사장냥의 무기도 뺄 수 있다 (585번).
      await expect(page.getByTestId('cat-unequip')).toHaveCount(1)
      await shot('boss')
      // 사장냥이 남은 리볼버 D를 든다.
      await equip(page, cell(page, 'D').first())
      await expect(cell(page, 'D', 'boss')).toHaveAttribute('aria-pressed', 'true')
      await expect(cell(page, 'F', 'boss')).toHaveCount(0)
      assert.deepEqual(calls, ['/weapon D'])
      await equip(page, cell(page, 'F').first())
      await expect(cell(page, 'F', 'boss')).toHaveAttribute('aria-pressed', 'true')

      // 고양이 목록으로 돌아가 하늘냥을 누르면 스킬 설명이 나온다.
      await detail.getByTestId('cat-gun').click()
      await page.locator('[data-testid=cat][data-code=sky]').click()
      await expect(detail).toHaveAttribute('data-code', 'sky')
      const skill = detail.getByTestId('cat-skill')
      await expect(skill).toContainText('고유 스킬 메테오 스킬 Lv.1')
      await expect(skill).toContainText('운석이 떨어져')
      await expect(skill).toContainText('운석 → 대운석 → 유성우')
      await expect(detail.getByTestId('cat-skill-next')).toHaveText(
        '고양이 Lv.2에 스킬 Lv.2 · 앞으로 1레벨',
      )
      await page.locator('[data-testid=cat][data-code=night]').click()
      await expect(detail.getByTestId('cat-skill-next')).toHaveText('스킬 최고 레벨이에요')
      await page.locator('[data-testid=cat][data-code=sky]').click()

      // 하늘냥의 무기를 누르면 하늘냥의 장비 목록이 펴진다: 든 것, 남이 든 것, 남은 것.
      await detail.getByTestId('cat-gun').click()
      await expect(cell(page, 'E', 'sky')).toHaveAttribute('aria-pressed', 'true')
      await expect(cell(page, 'F', 'boss')).toBeDisabled()
      await expect(cell(page, 'F', 'boss')).toContainText('장착 중')
      await expect(cell(page, 'F', 'boss')).toContainText('사장냥')
      await expect(cell(page, 'S', 'mint')).toBeDisabled()
      await expect(cell(page, 'S', 'mint')).toContainText('민트냥')
      // 합칠 수 있는 무기 (#918): 권총 F는 넷 가운데 사장냥이 하나 들었다. 남은 셋이 한 상자의 두 칸이고, 수는 상자에 한 번만 적는다.
      const pair = (grade) => page.getByTestId('gear-pair').filter({ has: cell(page, grade) })
      await expect(cell(page, 'F')).toHaveCount(2)
      await expect(pair('F').getByTestId('gear-pair-count')).toHaveText('권총 ×3')
      await expect(pair('F')).toContainText('합성 가능')
      await expect(pair('D').getByTestId('gear-pair-count')).toHaveText('리볼버 ×2')
      await expect(page.getByTestId('gear-pair')).toHaveCount(2)
      // 못 합치는 무기는 나누지 않는다: 하나 남은 권총 E는 한 칸, 가장 높은 등급(LR) 둘은 한 칸에 ×2다.
      await expect(cell(page, 'E')).toHaveCount(1)
      await expect(cell(page, 'LR')).toHaveCount(1)
      await expect(cell(page, 'LR')).toContainText('×2')
      await noOverflow(page)
      await shot('cat-detail')

      // 남이 든 칸은 눌러도 아무 일이 없다.
      await cell(page, 'S', 'mint').click({ force: true })
      await cell(page, 'S', 'mint').dispatchEvent('click')
      assert.equal(calls.length, 2)

      // 하늘냥이 리볼버 D를 든다. 든 무기는 못 끈다.
      await equip(page, cell(page, 'D').first())
      await expect(cell(page, 'D', 'sky')).toHaveAttribute('aria-pressed', 'true')
      assert.equal(calls.at(-1), '/cat/weapon sky D')
      assert.deepEqual(company.idle.cats[0].weapon, { kind: 'revolver', grade: 'D' })
      await expect(cell(page, 'E')).toHaveCount(2)

      // 끌기: 권총 F를 다른 무기(E) 위에 놓으면 아무 일이 없다.
      const drag = async (from, to, mid) => {
        // 낮은 화면에서는 목록이 시트 안에서 넘어간다: 두 칸이 다 보이게 한다.
        await to.scrollIntoViewIfNeeded()
        await from.scrollIntoViewIfNeeded()
        const a = await center(from)
        const b = await center(to)
        await page.mouse.move(a.x, a.y)
        await page.mouse.down()
        await page.mouse.move(a.x + 12, a.y + 4, { steps: 3 })
        await page.mouse.move(b.x, b.y, { steps: 8 })
        if (mid) await mid()
        await page.mouse.up()
      }
      const before = calls.length
      await drag(cell(page, 'F').first(), cell(page, 'E').first(), async () => {
        await expect(page.getByTestId('cat-gear')).toHaveAttribute('data-dragging', /pistol-F/)
        // 끄는 동안 합칠 수 있는 칸만 강조된다: 같은 권총 F의 다른 칸 하나.
        await expect(page.locator('[data-testid=cat-weapon][data-target]')).toHaveCount(1)
        await expect(cell(page, 'F').last()).toHaveAttribute('data-target', 'true')
        await expect(page.getByTestId('gear-hint')).toHaveText(
          '같은 무기 위에 놓으면 E 등급이 돼요',
        )
      })
      await expect(page.getByTestId('cat-gear')).not.toHaveAttribute('data-dragging', /.+/)
      // 가장 높은 등급(LR)은 둘이어도 못 합친다: 놓을 칸이 없다.
      await drag(cell(page, 'LR'), cell(page, 'E').first(), async () => {
        await expect(page.locator('[data-testid=cat-weapon][data-target]')).toHaveCount(0)
        await expect(page.getByTestId('gear-hint')).toHaveText(
          '가장 높은 등급이라 더 합칠 수 없어요',
        )
      })
      // 수가 모자란 무기: 리볼버 D는 둘 가운데 하늘냥이 하나 들어 남은 것이 하나다.
      await drag(cell(page, 'D').first(), cell(page, 'D', 'sky'), async () => {
        await expect(page.locator('[data-testid=cat-weapon][data-target]')).toHaveCount(0)
        await expect(page.getByTestId('gear-hint')).toHaveText(
          '아무도 안 든 같은 무기가 2개 있어야 합쳐져요',
        )
      })
      // 끌다가 제자리에 놓아도 장착되지 않는다.
      await drag(cell(page, 'F').first(), cell(page, 'F').first())
      await page.waitForTimeout(150)
      assert.equal(calls.length, before, '합칠 수 없는 칸에 놓으면 아무 일이 없다')
      await expect(page.getByTestId('merge-result')).toHaveCount(0)

      // 권총 F를 같은 권총 F 위에 놓으면 합쳐져 권총 E가 하나 는다.
      await drag(cell(page, 'F').first(), cell(page, 'F').last(), async () => {
        await expect(cell(page, 'F').last()).toHaveClass(/is-over/)
        await shot('drag')
      })
      await expect(page.getByTestId('merge-result')).toBeVisible()
      await expect(page.getByTestId('merge-result')).toHaveAttribute('data-grade', 'E')
      await expect(page.getByTestId('merge-result')).toContainText('합치기 성공!')
      await page.waitForTimeout(500)
      await shot('merged')
      assert.equal(calls.at(-1), '/weapon/merge F')
      assert.equal(company.weapons.find((w) => w.grade === 'F').count, 2)
      assert.equal(company.weapons.find((w) => w.grade === 'E').count, 3)
      // 권총 F는 이제 사장냥의 하나와 남은 하나뿐이라 더 못 합친다: 상자가 풀려 한 칸이다.
      await expect(cell(page, 'F')).toHaveCount(1)
      await expect(pair('F')).toHaveCount(0)
      await expect(page.getByTestId('merge-result')).toHaveCount(0, { timeout: 4000 })

      // 끌지 않고 합치기: 단추로도 합친다(키보드·화면 낭독기).
      await page.getByTestId('gear-manual').click()
      await expect(page.getByTestId('gear-merge')).toHaveCount(1)
      await expect(page.getByTestId('gear-merge')).toHaveText('권총 E 2개 → D')
      await page.getByTestId('gear-merge').focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('merge-result')).toHaveAttribute('data-grade', 'D')
      assert.equal(company.weapons.find((w) => w.grade === 'E').count, 1)
      assert.equal(company.weapons.find((w) => w.kind === 'pistol' && w.grade === 'D').count, 1)
      // 더 합칠 무기가 없다: 권총 E·D는 하나씩, 리볼버 D는 둘 가운데 하늘냥이 하나 들었다.
      await expect(page.getByTestId('gear-manual')).toHaveCount(0)
      await expect(page.getByTestId('gear-pair')).toHaveCount(0)

      // 무기 빼기.
      await page.getByTestId('cat-unequip').click()
      await expect(cell(page, 'D', 'sky')).toHaveCount(0)
      assert.equal(company.idle.cats[0].weapon, null)
      await noOverflow(page)
      await page.getByRole('button', { name: '닫기 ✕' }).click()

      assert.deepEqual(refused, [], '화면은 서버가 거절할 일을 시키지 않는다')
      assert.deepEqual(errors, [])
      await page.close()
    }
    // ── 터치: 누르면 비교, 집어서 끌면 합치기, 바로 위아래로 밀면 목록 넘기기 ─────────────
    {
      const { company, refused, calls, route } = world()
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: true,
        isMobile: true,
      })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, route)
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
      await page.getByRole('button', { name: CAT_MENU }).last().click()
      await page.getByTestId('cat-gun').click()
      const cdp = await context.newCDPSession(page)
      const touch = (type, x, y) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }],
        })
      await cell(page, 'F').last().scrollIntoViewIfNeeded()
      const a = await center(cell(page, 'F').first())
      const b = await center(cell(page, 'F').last())
      // 누르자마자 밀면 끌기가 아니다.
      await touch('touchStart', a.x, a.y)
      await touch('touchMove', a.x, a.y - 30)
      await expect(page.getByTestId('cat-gear')).not.toHaveAttribute('data-dragging', /.+/)
      await touch('touchEnd')
      assert.equal(calls.length, 0)
      // 길게 눌러 같은 무기 위로 끌어 놓는다.
      const a2 = await center(cell(page, 'F').first())
      const b2 = await center(cell(page, 'F').last())
      await touch('touchStart', a2.x, a2.y)
      await page.waitForTimeout(450)
      await expect(page.getByTestId('cat-gear')).toHaveAttribute('data-dragging', /pistol-F/)
      for (let i = 1; i <= 6; i++)
        await touch('touchMove', a2.x + ((b2.x - a2.x) * i) / 6, a2.y + ((b2.y - a2.y) * i) / 6)
      await expect(cell(page, 'F').last()).toHaveClass(/is-over/)
      await touch('touchEnd')
      await expect(page.getByTestId('merge-result')).toHaveAttribute('data-grade', 'E')
      assert.deepEqual(calls, ['/weapon/merge F'])
      assert.equal(company.weapons.find((w) => w.grade === 'E').count, 3)
      // 누르면 비교, 단추로 장착: 사장냥이 권총 E를 든다.
      await cell(page, 'E').first().tap()
      await page.getByTestId('gear-equip').tap()
      await expect(cell(page, 'E', 'boss')).toHaveAttribute('aria-pressed', 'true')
      assert.equal(calls.at(-1), '/weapon E')
      const bulk = page.getByRole('button', { name: /^일괄 합성/ })
      await bulk.tap()
      await expect(bulk).toBeDisabled()
      assert.equal(calls.at(-1), '/weapon/merge-all')
      await expect(page.getByText('무기 일괄 합성을 마쳤어요.')).toBeVisible()
      assert.ok(a && b)
      assert.deepEqual(refused, [])
      assert.deepEqual(errors, [])
      await context.close()
    }
    console.log(
      width,
      '뽑기 고르기 · 스킬 설명 · 장착 중 표시 · 합칠 수 있는 무기 묶음 · 끌어서 합치기(마우스·터치) · 단추 합치기 OK',
    )
  }
} finally {
  await browser.close()
}
