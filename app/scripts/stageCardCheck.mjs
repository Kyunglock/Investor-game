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
    const first =
      width === 320
        ? cat('night', '밤냥', 'A', [{ code: 'meteor', name: '메테오' }], true)
        : cat(
            'silver',
            '은빛냥',
            'S',
            [
              { code: 'bolt', name: '번개' },
              { code: 'lightArrow', name: '빛화살' },
            ],
            true,
          )
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
        // 확인할 팀은 첫 고양이 → 하늘냥 → 민트냥 → 라일락냥 순서다. 노을냥은 쉬고 있어 나오지 않는다.
        { ...cat('sky', '하늘냥', 'C', [], true), slot: 1 },
        { ...first, slot: 0 },
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
    const beats = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      if (route.request().url().endsWith('/company/assault')) {
        reports.push(route.request().postDataJSON())
      }
      // 방치형 전투의 박동 (682번): 스테이지를 하는 동안에는 가지 않는다.
      if (route.request().url().endsWith('/company/idle')) {
        beats.push(route.request().postDataJSON().action)
      }
      return route.fulfill({ json: company })
    })
    await page.addInitScript(() => {
      window.__mentalCards = ['rally', 'stopLoss', 'cat']
      // 고양이가 나오는 차례는 판마다 무작위다 (695번): 확인하는 동안에는 출전 칸의 차례로 고정한다.
      window.__mentalCatOrder = true
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
    await expect(page.getByTestId('stage-mode')).toContainText('디펜스 · 몬스터 10웨이브')
    // 출전 화면의 출전 고양이 줄 (682번): 출전 칸의 차례대로, 쉬는 노을냥은 없다.
    const lobbyCats = page.getByTestId('stage-lobby-cat')
    assert.deepEqual(await lobbyCats.evaluateAll((els) => els.map((el) => el.dataset.code)), [
      first.code,
      'sky',
      'mint',
      'lilac',
    ])
    // 스킬은 글이 아니라 그림으로: 첫 고양이의 고유 스킬을 모두 보이고, 스킬 없는 하늘냥은 비고 "총만 쏜다"도 없다.
    for (const skill of first.skills)
      await expect(lobbyCats.first().getByRole('img', { name: skill.name })).toBeVisible()
    const face = lobbyCats.first().locator('.idle-cat-face')
    const faceAttr = width === 320 ? 'viewBox' : 'src'
    const portrait = await face.getAttribute(faceAttr)
    assert.ok(portrait)
    await expect(lobbyCats.nth(1).locator('.stage-lobby-team-skills > *')).toHaveCount(0)
    await expect(page.getByTestId('stage-lobby-team')).not.toContainText('총만 쏜다')
    // 메인 스테이지의 출전 화면에는 사장냥 뒷모습과 무기 칸이 없다.
    await expect(page.locator('.stage-portrait')).toHaveCount(0)
    await expect(page.getByTestId('stage-weapon')).toHaveCount(0)
    // 미니맵(타임라인)과 적 범례는 두지 않는다.
    await expect(page.getByTestId('stage-timeline')).toHaveCount(0)
    await expect(page.locator('.stage-enemies')).toHaveCount(0)
    await page.getByRole('button', { name: '스테이지 출전 편성' }).click()
    const grid = page.locator('.stage-team-editor .idle-cat-grid')
    assert.equal(
      await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      4,
    )
    await expect(grid.locator('[data-code="sunset"]')).toBeDisabled()
    await grid.locator('[data-code="lilac"]').click()
    await page.getByRole('searchbox').fill('노을')
    await expect(grid.getByRole('button')).toHaveCount(1)
    await grid.getByRole('button').click()
    await page.getByRole('button', { name: '편성 완료' }).click()
    await expect(lobbyCats.last()).toHaveAttribute('data-code', 'sunset')
    const lobby = page.getByTestId('mental-lobby')
    const overflow = await lobby.evaluate((el) => el.scrollWidth - el.clientWidth)
    assert.equal(overflow, 0, '출전 화면이 옆으로 넘치지 않는다')
    await page.screenshot({ path: `/tmp/stage-lobby-${width}.png` })
    await page.getByRole('button', { name: /출발/ }).click()
    const pick = page.getByTestId('mental-levelup')
    await expect(pick).toBeVisible({ timeout: 60000 })
    // 스테이지를 하는 동안에는 방치형 전투가 선다 (682번): 화면의 전투가 멈추고 박동은 stop으로 끊긴 뒤 더 가지 않는다.
    await expect.poll(() => beats.at(-1), { timeout: 10000 }).toBe('stop')
    const sent = beats.length
    await page.waitForTimeout(2500)
    assert.equal(beats.length, sent, 'no idle beat during the stage')
    // 확인하는 동안에는 적을 잡아도 레벨이 오르지 않게 둔다: 카드 고르기는 아래에서 부를 때만 뜬다.
    await page.evaluate(() => window.__mentalXp(false))
    await expect(pick.locator('[data-card]')).toHaveCount(3)
    // 웨이브 판 (690번): 남은 시간이 아니라 지금 웨이브를 보인다.
    await expect(page.getByTestId('battle-timer')).toHaveCount(0)
    await expect(page.getByTestId('battle-wave')).toHaveText('웨이브 1/10')
    await expect(pick.locator('[data-card=rally]')).toContainText('불장')
    await expect(pick.locator('[data-card=rally]')).toContainText('1분 동안')
    await expect(pick.locator('[data-card=rally]')).toContainText('사장냥 스킬')
    await expect(pick.locator('[data-card=stopLoss]')).toContainText('바로 발동')
    // 고양이 카드는 첫 칸의 고양이를 부른다.
    await expect(pick.locator('[data-card=cat]')).toContainText(`${first.name} 출전`)
    await expect(pick.locator('[data-card=cat] .idle-cat-face')).toHaveAttribute(faceAttr, portrait)
    await expect(pick.locator('[data-card=cat]')).toContainText(
      `고유 스킬 ${first.skills.map((s) => s.name).join('·')} ★☆☆☆☆`,
    )
    await page.screenshot({ path: `/tmp/stage-cards-${width}.png` })
    await pick.locator('[data-card=cat]').click()
    await expect(pick).toHaveCount(0, { timeout: 15000 })
    // 첫 고양이가 제 고유 스킬을 쓴다.
    await expect
      .poll(() => page.evaluate(() => window.__mentalDamage?.mates ?? 0), { timeout: 15000 })
      .toBe(1)
    assert.deepEqual(
      await page.evaluate(() => window.__mentalDamage.skillMarks),
      width === 320 ? [['meteor']] : [['lightning', 'lightArrow']],
    )
    await page.screenshot({ path: `/tmp/stage-cat-${width}.png` })
    // 다음 레벨업: 출전한 고양이의 스킬이 모두 Lv.2로 오른다. 불장도 함께 나온다.
    await page.evaluate(() => {
      window.__mentalCards = ['cat-skill', 'rally', 'cat']
      window.__mentalLevelUp()
    })
    await expect(pick).toBeVisible({ timeout: 15000 })
    await expect(pick.locator('[data-card=cat-skill]')).toContainText(`${first.name} 강화`)
    await expect(pick.locator('[data-card=cat-skill]')).toContainText('★☆☆☆☆ → ★★☆☆☆')
    await expect(pick.locator('[data-card=cat]')).toContainText('하늘냥 출전')
    for (const skill of first.skills)
      await expect(
        pick.locator(`[data-card=cat-skill] [data-skill="${skill.code}"]`),
      ).toHaveAttribute('data-level', '2')
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
      ['노을냥', 4],
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
    await expect(page.locator('.battle-cards .idle-cat-portrait')).toHaveCount(4)
    await expect(page.locator('.battle-cards .idle-cat-face').first()).toHaveAttribute(
      faceAttr,
      portrait,
    )
    await page.waitForTimeout(800)
    const health = page.getByTestId('battle-wall')
    await expect(health).toHaveText(/\d+ \/ \d+/)
    await expect(page.locator('.battle-footer .battle-health')).toHaveCount(0)
    const wallText = await health.boundingBox()
    const icons = await page.locator('.battle-cards').boundingBox()
    const catY = await page.evaluate(() => window.__mentalMarket().stand.y)
    assert.ok(wallText && icons && icons.y >= wallText.y + wallText.height)
    assert.ok(icons.y + icons.height < catY - 40, 'icons clear the cats')
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
    // 웨이브 판 (690번): 제한 시간 없이 몬스터 웨이브가 차례로 오고, 열 웨이브를 다 물리치면 깬다. 나오는 것은 몬스터뿐이다(매도벽 없음).
    await page.evaluate(() => {
      window.__mentalXp(false)
      // 결과 화면까지 검사할 수 있도록 최대치와 현재 멘탈을 함께 채운다.
      window.__mentalMagic({ damage: 100000, maxMental: 100000, heal: 100000 })
      window.__mentalSpeed?.(6)
    })
    await expect(page.getByTestId('battle-wave')).toHaveText(/웨이브 ([3-9]|10)\/10/, {
      timeout: 90000,
    })
    assert.equal(await page.evaluate(() => window.__mentalWalls().length), 0)
    await page.screenshot({ path: `/tmp/stage-wave-${width}.png` })
    const result = page.getByTestId('mental-result')
    await expect(result).toBeVisible({ timeout: 180000 })
    await expect(page.getByTestId('mental-wave')).toHaveText('10웨이브를 모두 물리쳤다')
    await expect
      .poll(() => reports.at(-1), { timeout: 15000 })
      .toMatchObject({ stage: 1, cleared: true })
    await page.screenshot({ path: `/tmp/stage-wave-clear-${width}.png` })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log(
    '스테이지 320/390px: 디펜스·출전한 고양이의 카드·스킬 강화·사장냥 스킬·경험치 레벨업·웨이브 열 번 통과',
  )
} finally {
  await browser.close()
}
