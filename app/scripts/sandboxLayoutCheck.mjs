// 테스트판 (decisions.md 499번, #919): 테스트판 단추와 프레임 표시가 환생·광고 스킬·스킬 단추와 겹치지 않고 눌리며, 무한 다이아는 상점에서도 ∞다(돈은 무한이 아니다, 650번).
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
try {
  for (const [width, height] of [
    [390, 844],
    [320, 568],
  ]) {
    const company = {
      ...structuredClone(fixture),
      sandbox: true,
      sandboxInfinite: true,
      capital: 1.04e10,
      idle: {
        wall: 120,
        hp: 1000000,
        maxHp: 1000000,
        dps: 0,
        earned: 0,
        boss: false,
        circuitSeconds: 0,
        sequence: 0,
        upcoming: [],
        skills: [],
        cats: [],
        fieldSlots: 4,
        wallDps: 0,
        power: 1,
        income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
        offline: null,
        rebirth: { count: 0, fish: 0, gain: 5, fromWall: 51, adGain: 15, upgrades: [] },
        actives: [
          ['boostFire', '공격속도 3배', true],
          ['boostDamage', '공격력 3배', true],
          ['boostBuy', '매수공격 3배', true],
        ].map(([code, name, ad]) => ({
          code,
          name,
          cooldown: 60,
          seconds: 60,
          readyIn: 0,
          left: 0,
          ad,
        })),
      },
    }
    company.diamonds.amount = 1e11
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const used = []
    await page.route(/\/api\/(company|sessions|sandbox)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.includes('/active')) used.push(path)
      await route.fulfill({ json: company })
    })
    const url = new URL(process.env.APP_URL ?? 'http://localhost:5182/app/')
    url.searchParams.set('test', '1')
    await page.goto(url.href)
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    const tools = page.getByTestId('idle-sandbox')
    const frames = page.getByTestId('idle-frames')
    await expect(tools).toBeVisible()
    await expect(frames).toBeVisible()

    const hud = await page.locator('.idle-hud').boundingBox()
    const others = {
      환생: await page.getByTestId('rebirth-shortcut').boundingBox(),
      '광고 스킬': await page.getByTestId('idle-ad-actives').boundingBox(),
      스테이지: await page.getByTestId('stage-shortcut').boundingBox(),
    }
    for (const [name, mine] of [
      ['테스트판 단추', await tools.boundingBox()],
      ['프레임 표시', await frames.boundingBox()],
    ]) {
      assert.ok(mine.y >= hud.y + hud.height, `${width}: ${name}가 머리띠 아래에 있다`)
      assert.ok(mine.x >= 0 && mine.x + mine.width <= width, `${width}: ${name}가 화면 안에 있다`)
      assert.ok(mine.width >= 44 && mine.height >= 44, `${width}: ${name}는 누를 만한 크기다`)
      for (const [other, box] of Object.entries(others)) {
        assert.ok(!overlaps(mine, box), `${width}: ${name}가 ${other} 단추와 겹치지 않는다`)
        // 옆으로 비키는 것이 아니라 세로로 떨어져 있다: 단추 열의 높이가 바뀌어도 겹치지 않게.
        assert.ok(mine.y + mine.height <= box.y, `${width}: ${name}가 ${other} 단추보다 위에 있다`)
      }
    }

    // 도구 단추를 누르면 도구 창이 열리고 광고 스킬은 켜지지 않는다. 다른 것이 덮고 있으면 누르기가 실패한다.
    await tools.click({ timeout: 5000 })
    await expect(page.getByTestId('idle-sandbox-panel')).toBeVisible()
    assert.deepEqual(used, [], `${width}: 도구를 눌렀는데 스킬이 쓰였다`)
    await page.getByTestId('idle-sandbox-panel').getByRole('button', { name: '닫기' }).click()
    await expect(page.getByTestId('idle-sandbox-panel')).toHaveCount(0)

    // 설정 창은 테스트판 단추 위에 열린다.
    await page.getByTestId('idle-options').click()
    await page.getByTestId('sound-toggle').click({ timeout: 5000, trial: true })
    await page.getByTestId('power-save-on').click({ timeout: 5000, trial: true })
    await page.keyboard.press('Escape')

    // 환생 단추가 눌린다.
    await page.getByTestId('rebirth-shortcut').click({ timeout: 5000 })
    await expect(page.getByTestId('rebirth')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('rebirth')).toHaveCount(0)

    // 무한 다이아는 머리띠와 상점 위 줄 모두 ∞다. 돈은 무한이 아니라 가진 만큼 적는다 (650번).
    await expect(page.getByTestId('idle-diamonds')).toHaveText('∞')
    await page.locator('.idle-nav button', { hasText: '상점' }).click()
    await expect(page.getByTestId('shop-wallet')).toContainText('다이아 ∞')
    await expect(page.getByTestId('shop-wallet')).not.toContainText('게임 재화 전용∞')
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`sandbox layout ok (${width}x${height})`)
  }
} finally {
  await browser.close()
}
