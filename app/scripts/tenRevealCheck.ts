// 10연차 뽑기 연출 (decisions.md 574번): 상자가 열리면 받은 장을 한 장씩 보여 주고, 마지막에 모두 모아 보여 준다. A등급 이상은 빛난다.
// 실행: pnpm dev 를 띄운 뒤 node scripts/tenRevealCheck.ts
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const cats = [
  ['sky', '하늘냥'],
  ['mint', '민트냥'],
  ['lilac', '라일락냥'],
  ['sunset', '노을냥'],
].map(([code, name], i) => ({
  code,
  name,
  level: i < 2 ? 1 : 0,
  damagePercent: 50,
  firePercent: 100,
  criticalPercent: 100,
  fielded: i < 2,
  skills: [],
  skillLevel: 1,
  skillNextLevel: 10,
  grade: 'C',
  weapon: null,
}))
const company = {
  ...structuredClone(fixture),
  idle: {
    wall: 13,
    hp: 1200,
    maxHp: 1200,
    dps: 12,
    earned: 0,
    boss: false,
    circuitSeconds: 0,
    sequence: 0,
    upcoming: [],
    skills: [],
    fieldSlots: 4,
    rebirth: { count: 0, fish: 0, gain: 0, fromWall: 51 },
    wallDps: 0,
    power: 1038,
    income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
    offline: null,
    cats,
  },
}
// 열한 장: C 여덟, B 하나, A 하나, S 하나.
const GRADES = ['C', 'C', 'A', 'C', 'B', 'C', 'C', 'S', 'C', 'C', 'C']
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/idle')) company.idle.sequence = route.request().postDataJSON().sequence
      if (path.endsWith('/cat/draw')) {
        Object.assign(company.idle, {
          lastDraws: GRADES.map((grade, i) => ({
            code: company.idle.cats[i % company.idle.cats.length].code,
            grade,
            level: i + 1,
            isNew: i === 2,
          })),
        })
      }
      await route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/')
    await page.getByRole('button', { name: /^상점/ }).last().click({ timeout: 60000 })
    await page.getByTestId('cat-draw-ten').click()
    const single = page.getByTestId('cat-ten-single')
    // 상자를 누르면 바로 첫 장이다. 움직임을 줄였으면 상자 없이 첫 장이 선다.
    if (reducedMotion === 'no-preference') await page.getByTestId('cat-ten-skip').click()
    for (const [i, grade] of GRADES.entries()) {
      await expect(page.getByTestId('cat-ten-count')).toHaveText(`${i + 1} / ${GRADES.length}`)
      await expect(single).toContainText(`${grade} 등급`)
      // A등급부터 빛난다.
      await expect(single).toHaveAttribute('data-shiny', String(grade === 'A' || grade === 'S'))
      await expect(page.getByTestId('cat-ten-card')).toHaveCount(0)
      if (process.env.OUT && reducedMotion === 'no-preference' && (i === 0 || grade === 'S')) {
        await page.waitForTimeout(700)
        await page.screenshot({ path: `${process.env.OUT}/ten-${grade}.png` })
      }
      await single.click()
    }
    // 마지막 장 다음은 모아 보기: 뽑힌 장이 모두 보이고 빛나는 장은 둘이다.
    await expect(page.getByTestId('cat-ten-card')).toHaveCount(GRADES.length)
    await expect(page.locator('[data-testid=cat-ten-card][data-shiny=true]')).toHaveCount(2)
    await expect(page.getByTestId('cat-ten')).toContainText('A등급 이상 2')
    if (process.env.OUT && reducedMotion === 'no-preference') {
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${process.env.OUT}/ten-result.png` })
    }
    // 한 번 더 뽑고 "모두 보기"로 건너뛴다.
    await page.getByTestId('cat-ten-again').click()
    if (reducedMotion === 'no-preference') await page.getByTestId('cat-ten-skip').click()
    await expect(page.getByTestId('cat-ten-count')).toHaveText(`1 / ${GRADES.length}`)
    await page.getByTestId('cat-ten-all').click()
    await expect(page.getByTestId('cat-ten-card')).toHaveCount(GRADES.length)
    await page.getByTestId('cat-ten-close').click()
    await expect(page.getByTestId('cat-ten')).toHaveCount(0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('tenRevealCheck ok')
} finally {
  await browser.close()
}
