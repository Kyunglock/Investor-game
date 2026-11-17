// 전투에서 고양이가 출전 칸의 번호순으로 왼쪽부터 서는지 확인한다 (decisions.md 599번).
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  // 도감 순서와 다르게 세운다: 3번 칸의 하늘냥이 도감에서는 가장 앞이다.
  const seats = { sky: 3, mint: 0, lilac: 2, sunset: 1 }
  const names = ['하늘냥', '민트냥', '라일락냥', '노을냥', '밤냥']
  const codes = ['sky', 'mint', 'lilac', 'sunset', 'night']
  const grades = { sky: 'S', mint: 'A', lilac: 'B' }
  const marks = { S: '★ ', A: '◆ ', B: '', C: '' }
  const cats = codes.map((code, i) => ({
    code,
    name: names[i],
    level: 1,
    damagePercent: 50,
    firePercent: 100,
    criticalPercent: 100,
    fielded: code in seats,
    slot: seats[code] ?? null,
    skills: [],
    skillLevel: 1,
    skillNextLevel: 20,
    // 등급마다 이름표가 다르다 (605번).
    grade: grades[code] ?? 'C',
    weapon: null,
  }))
  const company = {
    ...structuredClone(fixture),
    idle: {
      wall: 1,
      hp: 1000000,
      maxHp: 1000000,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      upcoming: [],
      skills: [],
      cats,
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
    },
  }
  const fielded = cats.filter((cat) => cat.fielded)
  const expected = [...fielded].sort((a, b) => a.slot - b.slot).map((cat) => cat.code)
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.waitForTimeout(2500)
  const stand = await page.evaluate(() => window.__mentalMarket().stand)
  const looks = await page.evaluate(async (codes) => {
    const { CAT_LOOKS } = await import('/app/src/idle/loadout.ts')
    return codes.map((code) => CAT_LOOKS[code])
  }, expected)
  assert.equal(stand.xs.length, fielded.length + 1)
  assert.deepEqual(
    [...stand.xs].sort((a, b) => a - b),
    stand.xs,
    'the boss cat first, then the cats left to right',
  )
  assert.deepEqual(stand.looks, looks, 'cats stand in slot order')
  // 고양이 밑의 이름표 (605번): 사장냥과, 칸 번호순으로 등급과 이름.
  assert.deepEqual(stand.tags, [
    '♛ 사장냥',
    ...expected.map((code) => {
      const grade = grades[code] ?? 'C'
      return `${marks[grade]}${grade} ${names[codes.indexOf(code)]}`
    }),
  ])
  await page.screenshot({ path: '/tmp/seat-order.png' })
  // 꾹 누르면 그 고양이의 정보가 뜬다 (605번): 짧게 누르면 뜨지 않는다.
  const canvas = await page.locator('[data-testid=idle-canvas] canvas').boundingBox()
  const at = (i) => [canvas.x + stand.xs[i], canvas.y + stand.y - 10]
  await page.mouse.click(...at(2))
  await page.waitForTimeout(600)
  await expect(page.getByTestId('cat-info')).toHaveCount(0)
  await page.mouse.move(...at(2))
  await page.mouse.down()
  await expect(page.getByTestId('cat-info')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByTestId('cat-info')).toHaveAttribute('data-code', expected[1])
  await expect(page.getByTestId('cat-info')).toContainText(names[codes.indexOf(expected[1])])
  await page.screenshot({ path: '/tmp/cat-info.png' })
  await page.getByTestId('cat-info-close').click()
  await expect(page.getByTestId('cat-info')).toHaveCount(0)
  // 사장냥도 같다.
  await page.mouse.move(...at(0))
  await page.mouse.down()
  await expect(page.getByTestId('cat-info')).toHaveAttribute('data-code', 'boss')
  await page.mouse.up()
  await page.getByTestId('cat-info-close').click()
  // 출전 칸에도 같은 차례로 보인다.
  await page
    .getByRole('button', { name: /고양이/ })
    .first()
    .click()
  await expect
    .poll(() =>
      page
        .locator('[data-testid=cat-slot]')
        .evaluateAll((slots) => slots.map((slot) => slot.dataset.code ?? null)),
    )
    .toEqual(
      Array.from({ length: 4 }, (_, at) => fielded.find((cat) => cat.slot === at)?.code ?? null),
    )
  assert.deepEqual(errors, [])
  console.log(`seat order ok: ${expected.join(' ')}`)
} finally {
  await browser.close()
}
