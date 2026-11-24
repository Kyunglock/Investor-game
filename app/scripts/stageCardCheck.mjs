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
        // 출전 칸의 차례(slot)대로 나온다: 밤냥 → 하늘냥 → 민트냥 → 라일락냥. 노을냥은 쉬고 있어 나오지 않는다.
        { ...cat('sky', '하늘냥', 'C', [], true), slot: 1 },
        { ...cat('night', '밤냥', 'A', [{ code: 'meteor', name: '메테오' }], true), slot: 0 },
        { ...cat('mint', '민트냥', 'B', [], true), slot: 2 },
        { ...cat('lilac', '라일락냥', 'B', [], true), slot: 3 },
        cat('sunset', '노을냥', 'C', [], false),
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
    // 출전 고양이는 출전 탭의 것이다 (669번): 스테이지 고르기에 따로 고르는 칸은 없다.
    await expect(page.getByTestId('stage-team')).toHaveCount(0)
    await page.locator('[data-testid=assault-stage][data-stage="1"]').click()
    // 스테이지: 첫 카드 석 장에 사장냥의 스킬과 고양이 마법 강화가 나온다.
    // 출전 화면: 무기를 보고 들어간다.
    await expect(page.getByTestId('stage-mode')).toContainText('디펜스')
    await page.getByRole('button', { name: /출발/ }).click()
    const pick = page.getByTestId('mental-levelup')
    await expect(pick).toBeVisible({ timeout: 60000 })
    // 확인하는 동안에는 적을 잡아도 레벨이 오르지 않게 둔다: 카드 고르기는 아래에서 부를 때만 뜬다.
    await page.evaluate(() => window.__mentalXp(false))
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
    // 나머지 세 마리도 고양이 카드로 차례로 나와 모두 넷이 함께 싸운다.
    for (const [name, count] of [
      ['하늘냥', 2],
      ['민트냥', 3],
      ['라일락냥', 4],
    ]) {
      await page.evaluate(() => {
        window.__mentalCards = ['cat', 'rally', 'stopLoss']
        window.__mentalLevelUp()
      })
      await expect(pick).toBeVisible({ timeout: 15000 })
      await expect(pick.locator('[data-card=cat]')).toContainText(`${name} 출전`)
      await pick.locator('[data-card=cat]').click()
      await expect(pick).toHaveCount(0, { timeout: 15000 })
      await expect
        .poll(() => page.evaluate(() => window.__mentalDamage.mates), { timeout: 15000 })
        .toBe(count)
    }
    await page.waitForTimeout(800)
    await page.screenshot({ path: `/tmp/stage-four-${width}.png` })
    // 고른 불장이 1분 동안 켜진다(전투 초).
    await expect
      .poll(() => page.evaluate(() => window.__mentalMarket?.().actives.rally ?? 0), {
        timeout: 15000,
      })
      .toBeGreaterThan(50)
    const rally = await page.evaluate(() => window.__mentalMarket().actives.rally)
    assert.ok(rally <= 60, `rally lasts a minute: ${rally}`)
    await page.screenshot({ path: `/tmp/stage-rally-${width}.png` })
    // 디펜스 스테이지 (676번): 벽을 부수는 판이 아니다. 몰려오는 적을 잡은 경험치로 레벨이 올라 카드가 뜬다.
    assert.equal(await page.evaluate(() => window.__mentalWalls().length), 0)
    const kills = Number(await page.getByTestId('battle-level').locator('span b').textContent())
    await page.evaluate(() => {
      window.__mentalCards = ['rally', 'limitUp', 'cat']
      window.__mentalXp(true)
      window.__mentalSpeed?.(4)
    })
    await expect(pick).toBeVisible({ timeout: 90000 })
    await expect(pick).toContainText('한층 더 단단하게')
    assert.ok(
      Number(await page.getByTestId('battle-level').locator('span b').textContent()) > kills,
      'kills pay the level',
    )
    await page.screenshot({ path: `/tmp/stage-defense-card-${width}.png` })
    await pick.locator('[data-card=limitUp]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log(
    '스테이지 320/390px: 디펜스·출전한 고양이의 카드·스킬 강화·사장냥 스킬·경험치 레벨업 통과',
  )
} finally {
  await browser.close()
}
