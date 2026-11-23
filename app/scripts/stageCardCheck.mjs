// 매도벽 돌파 스테이지의 레벨업 카드 (decisions.md 667번): 메인 화면의 스테이지 단추로 들어가, 사장냥의 스킬 카드를 고르면 그 스킬이
// 1분 동안 켜지는지 본다. 개발 서버에서만 돈다(window.__mentalCards, __mentalMarket).
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const company = structuredClone(fixture)
    const cat = (code, name, grade, skills, fielded) => ({
      code,
      name,
      level: 1,
      damagePercent: 50,
      firePercent: 100,
      criticalPercent: 100,
      fielded,
      skills,
      skillLevel: 1,
      skillNextLevel: 10,
      grade,
      weapon: null,
    })
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
      actives: [],
      cats: [
        cat('sky', '하늘냥', 'C', [], true),
        cat('night', '밤냥', 'A', [{ code: 'meteor', name: '메테오' }], false),
        cat('mint', '민트냥', 'B', [], false),
      ],
    }
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    const reports = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      if (route.request().url().endsWith('/company/assault')) {
        reports.push(route.request().postDataJSON())
      }
      return route.fulfill({ json: company })
    })
    await page.addInitScript(() => {
      window.__mentalCards = ['rally', 'stopLoss', 'cat']
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    // 메인 화면: 사장냥의 스킬 단추와 레벨 단추는 없고 스테이지 입구가 있다.
    await expect(page.getByTestId('idle-active')).toHaveCount(0)
    await expect(page.getByTestId('idle-level')).toHaveCount(0)
    await page.getByTestId('stage-shortcut').click()
    // 출전 고양이 (669번): 고른 적이 없으면 출전 중인 하늘냥이다. 빼고, 밤냥(메테오)을 1번, 하늘냥을 2번으로 고른다.
    const team = page.getByTestId('stage-team')
    await expect(team.locator('[data-testid=stage-team-slot][data-code]')).toHaveCount(1)
    await expect(team.getByTestId('stage-team-slot').first()).toHaveAttribute('data-code', 'sky')
    await team.getByRole('button', { name: '1번 하늘냥 빼기' }).click()
    await expect(team.locator('[data-testid=stage-team-slot][data-code]')).toHaveCount(0)
    await team.locator('[data-testid=stage-team-cat][data-code=night]').click()
    await team.locator('[data-testid=stage-team-cat][data-code=sky]').click()
    await expect(team.getByTestId('stage-team-slot').first()).toHaveAttribute('data-code', 'night')
    await expect(team.getByTestId('stage-team-slot').nth(1)).toHaveAttribute('data-code', 'sky')
    await expect(team.getByTestId('stage-team-slot').first()).toContainText('메테오')
    await team.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/stage-team-${width}.png` })
    await page.locator('[data-testid=assault-stage][data-stage="1"]').click()
    // 스테이지: 첫 카드 석 장에 사장냥의 스킬과 고양이 마법 강화가 나온다.
    // 출전 화면: 무기를 보고 들어간다.
    await page.getByRole('button', { name: /돌파하러 가기/ }).click()
    const pick = page.getByTestId('mental-levelup')
    await expect(pick).toBeVisible({ timeout: 60000 })
    await expect(pick.locator('[data-card]')).toHaveCount(3)
    await expect(pick.locator('[data-card=rally]')).toContainText('불장')
    await expect(pick.locator('[data-card=rally]')).toContainText('1분 동안')
    await expect(pick.locator('[data-card=rally]')).toContainText('사장냥 스킬')
    await expect(pick.locator('[data-card=stopLoss]')).toContainText('바로 발동')
    // 고양이 카드는 1번으로 고른 밤냥을 부른다.
    await expect(pick.locator('[data-card=cat]')).toContainText('밤냥 출전')
    await expect(pick.locator('[data-card=cat]')).toContainText('고유 스킬 메테오 Lv.1')
    await page.screenshot({ path: `/tmp/stage-cards-${width}.png` })
    await pick.locator('[data-card=cat]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    // 밤냥이 제 이름표를 달고 나와 제 스킬(메테오)을 쓴다.
    await expect
      .poll(() => page.evaluate(() => window.__mentalDamage?.mates ?? 0), { timeout: 15000 })
      .toBe(1)
    assert.deepEqual(await page.evaluate(() => window.__mentalDamage.skillMarks), [['meteor']])
    await page.screenshot({ path: `/tmp/stage-cat-${width}.png` })
    // 다음 레벨업: 밤냥의 스킬 강화 카드가 나오고, 고르면 메테오가 Lv.2가 된다. 불장도 함께 나온다.
    await page.evaluate(() => {
      window.__mentalCards = ['cat-skill', 'rally', 'cat']
      window.__mentalLevelUp()
    })
    await expect(pick).toBeVisible({ timeout: 15000 })
    await expect(pick.locator('[data-card=cat-skill]')).toContainText('밤냥 스킬 강화')
    await expect(pick.locator('[data-card=cat-skill]')).toContainText('Lv.1 → Lv.2')
    await expect(pick.locator('[data-card=cat]')).toContainText('하늘냥 출전')
    await page.screenshot({ path: `/tmp/stage-cat-skill-${width}.png` })
    await pick.locator('[data-card=cat-skill]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    await expect
      .poll(() => page.evaluate(() => window.__mentalDamage.mateSkillLevels), { timeout: 15000 })
      .toEqual([2])
    await page.evaluate(() => {
      window.__mentalCards = ['rally', 'stopLoss', 'cat']
      window.__mentalLevelUp()
    })
    await expect(pick).toBeVisible({ timeout: 15000 })
    await pick.locator('[data-card=rally]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    // 고른 불장이 1분 동안 켜진다(전투 초).
    await expect
      .poll(() => page.evaluate(() => window.__mentalMarket?.().actives.rally ?? 0), {
        timeout: 15000,
      })
      .toBeGreaterThan(50)
    const rally = await page.evaluate(() => window.__mentalMarket().actives.rally)
    assert.ok(rally <= 60, `rally lasts a minute: ${rally}`)
    await page.screenshot({ path: `/tmp/stage-rally-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('스테이지 320/390px: 출전 고양이 고르기·고양이 카드·스킬 강화·사장냥 스킬 통과')
} finally {
  await browser.close()
}
