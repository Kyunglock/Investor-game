import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

/**
 * 넘길 수 없는 뽑기 (decisions.md 693번): S등급 이상의 고양이를 처음 얻으면 한 번 뽑기도 연속 뽑기도 3초 동안 축하 연출이 나오고,
 * 그동안 누르기·모두 보기·Esc가 듣지 않는다. 이미 가진 S등급은 전처럼 넘길 수 있다.
 */
const cat = (code, name, grade, level) => ({
  code,
  name,
  level,
  damagePercent: 50,
  firePercent: 100,
  criticalPercent: 100,
  fielded: code === 'sky',
  skills: [],
  skillLevel: 1,
  skillNextLevel: 10,
  grade,
  weapon: null,
})
const shots = process.env.SHOTS

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const company = structuredClone(fixture)
  company.diamonds.amount = 5000
  company.idle = {
    wall: 1,
    hp: 1200,
    maxHp: 1200,
    dps: 0,
    earned: 0,
    boss: false,
    circuitSeconds: 0,
    sequence: 0,
    upcoming: [],
    skills: [],
    fieldSlots: 4,
    wallDps: 0,
    power: 1,
    income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
    offline: null,
    lastDraws: [],
    cats: [
      cat('sky', '하늘냥', 'C', 1),
      cat('silver', '은빛냥', 'S', 0),
      cat('star', '별빛냥', 'S', 0),
    ],
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
    if (route.request().url().endsWith('/cat/draw')) {
      const { count } = route.request().postDataJSON()
      const level = (code) => ++company.idle.cats.find((c) => c.code === code).level
      const draw = (code, grade) => {
        const now = level(code)
        return { code, grade, level: now, isNew: now === 1 }
      }
      company.idle.lastDraws =
        count === 1
          ? [draw('silver', 'S')]
          : // 넷째 장만 처음 얻는 S등급이다. 일곱째 장은 같은 고양이가 또 나온 것이다.
            Array.from({ length: count }, (_, i) =>
              i === 3 || i === 6 ? draw('star', 'S') : draw('sky', 'C'),
            )
    }
    return route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5185/app/')
  await page.locator('[data-testid=idle-canvas] canvas').waitFor()
  await page.locator('.idle-nav button', { hasText: '상점' }).last().click()
  await page.getByTestId('draw-kind-cat').click()

  // 한 번 뽑기: 상자의 뜸은 눌러 건너뛰어도 축하 장면은 3초를 채운다.
  await page.getByTestId('cat-draw').click()
  await page.getByTestId('cat-reveal-skip').click()
  const wow = page.getByTestId('cat-reveal-wow')
  await expect(wow).toContainText('S 등급 새 고양이!')
  let began = Date.now()
  await page.keyboard.press('Escape')
  await wow.click()
  await page.waitForTimeout(1200)
  if (shots) await page.screenshot({ path: `${shots}/hold-single.png` })
  await expect(wow).toBeVisible()
  await expect(page.getByTestId('cat-drawn')).toHaveCount(0)
  await expect(page.getByTestId('cat-drawn')).toBeVisible()
  assert.ok(Date.now() - began >= 2900, `축하 장면이 ${Date.now() - began}ms 만에 끝났다`)
  await expect(page.getByTestId('cat-drawn')).toHaveAttribute('data-code', 'silver')
  if (shots) await page.screenshot({ path: `${shots}/hold-single-result.png` })
  // 이미 가진 S등급은 전처럼 바로 넘어간다.
  await page.getByTestId('cat-reveal-again').click()
  await expect(page.getByTestId('cat-drawn')).toHaveCount(0)
  await page.getByTestId('cat-reveal-skip').click()
  await expect(page.getByTestId('cat-drawn')).toContainText('레벨 업')
  await expect(wow).toHaveCount(0)
  await page.getByTestId('cat-reveal-close').click()

  // 연속 뽑기: "모두 보기"는 결과로 가지 않고 처음 얻은 S등급 장에서 멈춘다.
  await page.getByTestId('cat-draw-ten').click()
  await page.getByTestId('cat-ten-skip').click()
  const single = page.getByTestId('cat-ten-single')
  await expect(page.getByTestId('cat-ten-count')).toContainText('1 /')
  await page.getByTestId('cat-ten-all').click()
  await expect(page.getByTestId('cat-ten-count')).toContainText('4 /')
  await expect(single).toHaveAttribute('data-hold', 'true')
  await expect(single).toHaveAttribute('data-open', 'true')
  began = Date.now()
  await expect(page.getByTestId('cat-ten-all')).toBeDisabled()
  await expect(page.locator('.ten-reveal .jackpot-title')).toContainText('S 등급 새 고양이!')
  await single.click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  if (shots) await page.screenshot({ path: `${shots}/hold-ten.png` })
  await expect(page.getByTestId('cat-ten-count')).toContainText('4 /')
  await expect(page.getByTestId('cat-ten-all')).toBeEnabled()
  assert.ok(Date.now() - began >= 2800, `넘길 수 없는 장이 ${Date.now() - began}ms 만에 풀렸다`)
  // 풀린 뒤에는 남은 장(또 나온 S등급도)을 건너뛰어 결과로 간다.
  await page.getByTestId('cat-ten-all').click()
  await expect(page.getByTestId('cat-ten-card')).toHaveCount(company.idle.lastDraws.length)
  await page.getByTestId('cat-ten-close').click()
  await expect(page.getByTestId('cat-ten')).toHaveCount(0)
  assert.deepEqual(errors, [])
  console.log('holdRevealCheck 통과')
} finally {
  await browser.close()
}
