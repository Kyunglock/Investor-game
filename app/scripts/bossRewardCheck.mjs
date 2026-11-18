import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const [width, reduced] of [
    [390, false],
    [320, false],
    [320, true],
  ]) {
    const company = {
      ...structuredClone(fixture),
      idle: {
        wall: 51,
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
        bossReward: { wall: 50, money: 123000000, diamonds: 100 },
      },
    }
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
      route.fulfill({ json: company }),
    )
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/', { timeout: 90000 })
    await expect(page.getByTestId('idle-canvas-loading')).toHaveCount(0, { timeout: 30000 })
    await expect(page.locator('[data-reward-target="money"]')).toBeVisible()
    await expect(page.getByTestId('boss-reward')).toHaveCount(0)
    company.idle.bossReward = { wall: 100, money: 246000000, diamonds: 200 }
    await expect(page.getByTestId('boss-reward')).toHaveAttribute('data-wall', '100', {
      timeout: 15000,
    })
    await expect(page.getByTestId('boss-reward')).toContainText('+200')
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('.boss-reward')
      const rect = root.getBoundingClientRect()
      const result = {}
      for (const kind of ['money', 'diamond']) {
        const particles = [...root.querySelectorAll(`[data-reward-particle="${kind}"]`)]
        const target = document
          .querySelector(`[data-reward-target="${kind}"]`)
          .getBoundingClientRect()
        const animations = particles.flatMap((p) => p.getAnimations())
        result[kind] = {
          count: animations.length,
          target: {
            x: target.x + target.width / 2 - rect.x,
            y: target.y + target.height / 2 - rect.y,
          },
          ends: animations.map((a) => a.effect.getKeyframes().at(-1).transform),
        }
      }
      return result
    })
    for (const kind of ['money', 'diamond']) {
      assert.equal(geometry[kind].count, reduced ? 0 : 9)
      for (const end of geometry[kind].ends) {
        const values = end.match(/^translate\(([-\d.]+)px, ([-\d.]+)px\)/)
        assert.ok(values)
        assert.ok(Math.abs(Number(values[1]) - geometry[kind].target.x) < 1)
        assert.ok(Math.abs(Number(values[2]) - geometry[kind].target.y) < 1)
      }
    }
    assert.ok(geometry.money.target.x < width / 2)
    assert.ok(geometry.diamond.target.x > width / 2)
    assert.equal(
      await page.getByTestId('boss-reward').evaluate((el) => getComputedStyle(el).pointerEvents),
      'none',
    )
    await page.waitForTimeout(650)
    await page.screenshot({ path: `/tmp/boss-reward-${width}-${reduced ? 'reduce' : 'burst'}.png` })
    if (!reduced) {
      await expect
        .poll(
          () =>
            page
              .locator('.idle-cash')
              .evaluateAll((nodes) => nodes.some((n) => n.getAnimations().length > 0)),
          { timeout: 2000, intervals: [30] },
        )
        .toBe(true)
    }
    await expect(page.getByTestId('boss-reward')).toHaveCount(0, { timeout: 4000 })
    await page.waitForTimeout(1300)
    await expect(page.getByTestId('boss-reward')).toHaveCount(0)
    // 새 보상으로 교체해도 이전 타이머가 새 연출을 지우지 않는다.
    company.idle.bossReward = { wall: 150, money: 300000000, diamonds: 300 }
    await expect(page.getByTestId('boss-reward')).toHaveAttribute('data-wall', '150', {
      timeout: 15000,
    })
    company.idle.bossReward = { wall: 200, money: 400000000, diamonds: 400 }
    await expect(page.getByTestId('boss-reward')).toHaveAttribute('data-wall', '200', {
      timeout: 15000,
    })
    await page.setViewportSize({ width: width + 1, height: 844 })
    await expect(page.getByTestId('boss-reward')).toHaveCount(0)
    // 절전 중 받은 보상은 복귀할 때 밀려 나오지 않는다.
    await page.evaluate(async () =>
      (await import('/app/src/idle/powerSave.ts')).usePowerSave.getState().set(true),
    )
    company.idle.bossReward = { wall: 250, money: 500000000, diamonds: 500 }
    await page.waitForTimeout(1500)
    await page.evaluate(async () =>
      (await import('/app/src/idle/powerSave.ts')).usePowerSave.getState().set(false),
    )
    await expect(page.getByTestId('boss-reward')).toHaveCount(0)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`boss reward ok: ${width}px, reduced=${reduced}`)
  }
} finally {
  await browser.close()
}
