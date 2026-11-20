// 자잘한 표기 (#920): 설정 창의 세 줄이 모두 상태를 적고, 환생 확인 단추가 한 줄이고, 고양이·무기 시트가 머리띠 아래에서 멈추고, 광고 뽑기에 남은 횟수가 보인다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
const cats = [
  ['sky', '하늘냥'],
  ['mint', '민트냥'],
  ['lilac', '라일락냥'],
  ['sunset', '노을냥'],
  ['night', '밤냥'],
  ['snow', '눈꽃냥'],
]
try {
  for (const [width, height] of [
    [390, 844],
    [320, 568],
  ]) {
    const company = {
      ...structuredClone(fixture),
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
        cats: cats.map(([code, name], index) => ({
          code,
          name,
          level: 1,
          damagePercent: 50,
          firePercent: 100,
          criticalPercent: 100,
          fielded: index < 4,
          skills: [],
          skillLevel: 1,
          skillNextLevel: 10,
          grade: 'C',
          weapon: null,
        })),
        fieldSlots: 4,
        wallDps: 0,
        power: 1,
        income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
        offline: null,
        rebirth: { count: 0, fish: 0, gain: 5, fromWall: 51, adGain: 15, upgrades: [] },
      },
    }
    // 다이아가 없어도 광고 뽑기는 가능하다.
    company.diamonds.amount = 5
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
      route.fulfill({ json: company }),
    )
    const open = async () => {
      await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
      await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    }
    const menu = (label) => page.locator('.idle-nav button', { hasText: label }).last().click()
    await open()

    // 설정: 소리·진동·절전 모드 모두 지금 상태를 적는다. 절전 모드는 켜면 화면이 덮이므로 여기서는 늘 꺼짐이고, 누르면 켜진다.
    await page.getByTestId('idle-options').click()
    for (const id of ['sound-toggle', 'haptic-toggle', 'power-save-on']) {
      await expect(page.getByTestId(id).locator('.idle-options-state')).toHaveText(/^(켜짐|꺼짐)$/)
    }
    await expect(page.getByTestId('power-save-on')).toHaveText('절전 모드꺼짐')
    await expect(page.getByTestId('power-save-on')).toHaveAccessibleName('절전 모드 켜기')
    await page.getByTestId('power-save-on').click()
    const dark = page.getByTestId('power-save')
    await expect(dark).toBeVisible()
    await dark.click()
    await dark.click()
    await expect(dark).toHaveCount(0)

    // 환생 확인: "그냥 환생"의 생선 그림과 수가 광고 단추처럼 글자와 한 줄에 있다.
    await page.getByTestId('rebirth-shortcut').click()
    await page.getByTestId('rebirth-open').click()
    const plain = page.getByTestId('rebirth-confirm')
    await expect(plain).toHaveText(/그냥 환생\s*5/)
    const plainBox = await plain.boundingBox()
    const adBox = await page.getByTestId('rebirth-ad').boundingBox()
    assert.ok(
      plainBox.height <= adBox.height + 1,
      `${width}: 그냥 환생 단추가 한 줄이다 (${plainBox.height} / ${adBox.height})`,
    )
    const fish = await plain.locator('.idle-fish').boundingBox()
    const middle = plainBox.y + plainBox.height / 2
    assert.ok(
      Math.abs(fish.y + fish.height / 2 - middle) <= 4,
      `${width}: 생선 그림이 글자와 같은 줄에 있다`,
    )
    await page.keyboard.press('Escape')

    // 고양이·무기 시트는 머리띠를 덮지 않고, 안은 스크롤로 끝까지 닿는다.
    const hud = await page.locator('.idle-hud').boundingBox()
    await menu('고양이·무기')
    const sheet = page.getByTestId('idle-menu')
    await expect(sheet).toBeVisible()
    await expect
      .poll(async () => (await sheet.boundingBox()).y, {
        message: `${width}: 시트가 머리띠 아래다`,
      })
      .toBeGreaterThanOrEqual(hud.y + hud.height)
    const reach = await sheet.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      const last = el.lastElementChild.getBoundingClientRect()
      const box = el.getBoundingClientRect()
      return {
        left: el.scrollHeight - el.clientHeight - el.scrollTop,
        last: last.bottom,
        box: box.bottom,
      }
    })
    assert.ok(reach.left <= 1, `${width}: 시트 안을 끝까지 내릴 수 있다`)
    assert.ok(reach.last <= reach.box + 1, `${width}: 마지막 줄이 시트 안에 보인다`)

    await menu('상점')
    await expect(page.getByTestId('cat-draw-ten')).toBeVisible()
    await expect(page.getByTestId('cat-draw-ad')).toBeEnabled()
    await expect(page.getByTestId('cat-draw-ad')).toContainText('오늘 3 / 3회 남음')

    assert.deepEqual(errors, [])
    await page.close()
    console.log(`labels ok (${width}x${height})`)
  }
} finally {
  await browser.close()
}
