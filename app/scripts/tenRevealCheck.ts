// 10연차 뽑기 연출 (decisions.md 574번): 상자가 열리면 받은 장을 한 장씩 보여 주고, 마지막에 모두 모아 보여 준다. A등급 이상은 빛난다.
// 장은 뒷면으로 나와 뜸을 들인 뒤 열린다 (576번).
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
    rebirth: { count: 0, fish: 0, gain: 0, fromWall: 51, adGain: 0 },
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
    let draws = 0
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/idle')) company.idle.sequence = route.request().postDataJSON().sequence
      if (path.endsWith('/cat/draw')) {
        // 두 번째 뽑기는 S등급이 첫 장이다: 뜸이 1초라 뒷면일 때 누르는 것을 볼 수 있다.
        const order = ++draws > 1 ? [...GRADES].reverse().sort((a) => (a === 'S' ? -1 : 0)) : GRADES
        Object.assign(company.idle, {
          lastDraws: order.map((grade, i) => ({
            code: company.idle.cats[i % company.idle.cats.length].code,
            grade,
            level: i + 1,
            // 처음 얻은 장: 첫 장(C)과 셋째 장(A).
            isNew: i === 0 || i === 2,
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
      const shiny = grade === 'A' || grade === 'S'
      await expect(single).toHaveAttribute('data-shiny', String(shiny))
      if (reducedMotion === 'no-preference') {
        // 뒷면으로 나와 뜸을 들인 뒤 열린다 (576번): 보통 장은 금방, A등급 0.5초, S등급 1초.
        const shownAt = Date.now()
        // 보통 장은 0.22초 만에 열려, 느린 기계에서는 앞의 확인을 하는 사이에 이미 열려 있다. 뒷면은 빛나는 장에서만 본다.
        if (shiny) await expect(single).toHaveAttribute('data-open', 'false')
        if (process.env.OUT && grade === 'S') {
          await page.waitForTimeout(600)
          await page.screenshot({ path: `${process.env.OUT}/ten-S-back.png` })
        }
        await expect(single).toHaveAttribute('data-open', 'true', { timeout: 3000 })
        const waited = Date.now() - shownAt
        const least = grade === 'S' ? 900 : grade === 'A' ? 400 : 0
        assert(waited >= least, `${grade} opened after ${waited}ms, expected at least ${least}ms`)
        if (!shiny) assert(waited < 900, `${grade} opened after ${waited}ms: too slow`)
      }
      await expect(single).toHaveAttribute('data-open', 'true')
      await expect(single).toContainText(`${grade} 등급`)
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
    // 테두리 색은 등급으로만 정한다 (#917): 처음 얻은 C등급 장도 다른 C등급 장과 같은 색이고 B등급 색이 아니다.
    const borders = await page
      .getByTestId('cat-ten-card')
      .evaluateAll((cards) => cards.map((card) => getComputedStyle(card).borderTopColor))
    assert.equal(borders[0], borders[1], 'a new C card keeps the C colour')
    assert.notEqual(borders[0], borders[4], 'C and B cards differ')
    await expect(page.locator('[data-testid=cat-ten-card][data-new=true]')).toHaveCount(2)
    // '팀 편성하기'는 닫기처럼 테두리가 있는 단추다 (#917).
    const use = page.getByTestId('cat-ten-use')
    await expect(use).toHaveText(/팀 편성하기/)
    const useStyle = await use.evaluate((node) => {
      const style = getComputedStyle(node)
      return { border: Number.parseFloat(style.borderTopWidth), height: node.clientHeight }
    })
    assert(useStyle.border >= 1 && useStyle.height >= 40, 'the use action looks like a button')
    if (process.env.OUT && reducedMotion === 'no-preference') {
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${process.env.OUT}/ten-result.png` })
    }
    // 한 번 더 뽑고 "모두 보기"로 건너뛴다.
    await page.getByTestId('cat-ten-again').click()
    if (reducedMotion === 'no-preference') await page.getByTestId('cat-ten-skip').click()
    await expect(page.getByTestId('cat-ten-count')).toHaveText(`1 / ${GRADES.length}`)
    // 뒷면일 때 누르면 다음 장으로 가지 않고 바로 열린다.
    if (reducedMotion === 'no-preference') {
      await expect(single).toHaveAttribute('data-jackpot', 'true')
      await expect(single).toHaveAttribute('data-open', 'false')
      await single.dispatchEvent('click')
      await expect(single).toHaveAttribute('data-open', 'true', { timeout: 300 })
      await expect(page.getByTestId('cat-ten-count')).toHaveText(`1 / ${GRADES.length}`)
    }
    await page.getByTestId('cat-ten-all').click()
    await expect(page.getByTestId('cat-ten-card')).toHaveCount(GRADES.length)
    await page.getByTestId('cat-ten-close').click()
    await expect(page.getByTestId('cat-ten')).toHaveCount(0)
    // 알림은 마지막 장(라일락냥)이 아니라 가장 좋은 장(S등급, 첫 장의 하늘냥)을 가리킨다 (#911).
    await expect(page.getByTestId('draw-note')).toContainText('하늘냥')
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('tenRevealCheck ok')
} finally {
  await browser.close()
}
