import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
      hasTouch: true,
    })
    const company = {
      ...structuredClone(fixture),
      battleUpgrades: ['damage', 'fire', 'hp', 'buy', 'crit'].map((kind) => ({
        kind,
        level: 0,
        price: 100,
        priceGrowthPercent: 4,
        bonusPercent: 0,
        nextBonusPercent: 1,
        maxLevel: 0,
      })),
      idle: {
        wall: 1,
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
        wallDps: 0,
        power: 1000,
        offline: null,
        cats: [],
        income: { perSecond: 100, staffPerSecond: 0, bonusPercent: 0 },
      },
    }
    let requests = 0
    let reject = false
    let purchased = 1
    let finish: (() => void) | undefined
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/battle-upgrade')) {
        requests++
        const { kind } = route.request().postDataJSON()
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        if (reject) {
          await route.fulfill({ status: 409, json: { message: '강화할 자본이 부족해요' } })
          return
        }
        const u = company.battleUpgrades.find((u) => u.kind === kind)
        assert(u)
        u.level += purchased
        u.bonusPercent += purchased
        u.nextBonusPercent = u.bonusPercent + 1
        company.idle.power += purchased * 100
      }
      await route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL || 'http://localhost:5182/app/')
    await page.getByRole('button', { name: /^성장/ }).click()
    const row = page.locator('[data-testid=idle-stat][data-kind=damage]')
    const buy = row.getByRole('button')
    await buy.click()
    await expect(buy).toHaveAttribute('aria-busy', 'true')
    await expect(buy).toBeDisabled()
    await expect(page.getByTestId('upgrade-gain')).toHaveCount(0)
    await expect.poll(() => requests).toBe(1)
    assert(finish)
    finish()
    await expect(row.getByTestId('upgrade-gain')).toHaveText('강화 완료! Lv.+1 · +1%')
    await expect(row).toHaveAttribute('data-upgraded', 'true')
    await expect(page.getByTestId('idle-power')).toContainText('1,100')
    await page.screenshot({ path: `/tmp/upgrade-${width}.png`, fullPage: true })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    // Batch feedback uses the server's actual purchase, not the requested ten levels.
    await page.getByRole('button', { name: '×10', exact: true }).click()
    purchased = 3
    await buy.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => requests).toBe(2)
    assert(finish)
    finish()
    await expect(row.getByTestId('upgrade-gain')).toContainText('Lv.+3 · +3%')
    // A rejected request never celebrates, and the button is usable again.
    reject = true
    await buy.click()
    await expect.poll(() => requests).toBe(3)
    assert(finish)
    finish()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByTestId('upgrade-gain')).toHaveCount(0)
    await expect(buy).toBeEnabled()
    await expect(row).toContainText('Lv.4')
    // Leaving while a purchase is pending must not replay success on reopening.
    reject = false
    await buy.click()
    await expect.poll(() => requests).toBe(4)
    await page.getByRole('button', { name: '닫기 ✕', exact: true }).click()
    assert(finish)
    finish()
    await expect.poll(() => company.battleUpgrades[0].level).toBe(7)
    await page.getByRole('button', { name: /^성장/ }).click()
    await expect(page.getByTestId('upgrade-gain')).toHaveCount(0)
    await page.close()
    console.log(
      `PASS ${width}px: pending, confirmed gain, partial batch, rejection, keyboard, leave`,
    )
  }
} finally {
  await browser.close()
}
