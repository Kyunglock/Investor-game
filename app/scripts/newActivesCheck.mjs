// 실제 전투에서 상한가·손절·물타기(decisions.md 591번)가 도는지 확인한다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const company = {
    ...structuredClone(fixture),
    idle: {
      wall: 1,
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
    },
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const errors = []
  /** 서버에 알린 명중: 종류마다 횟수와 피해의 합. */
  const sent = {}
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/idle')) {
      const body = route.request().postDataJSON()
      company.idle.sequence = body.sequence
      for (const hit of body.hits ?? []) {
        sent[hit.kind] ??= { count: 0, damage: 0 }
        sent[hit.kind].count += hit.count
        sent[hit.kind].damage += hit.damage
      }
    }
    await route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await expect(page.locator('[data-testid=idle-canvas] canvas')).toBeVisible()
  await page.waitForTimeout(2500)
  const market = () => page.evaluate(() => window.__mentalMarket?.())
  const cast = (code) =>
    page.evaluate(
      (code) => window.dispatchEvent(new CustomEvent('idle-active', { detail: code })),
      code,
    )
  const perHit = (kind) => (sent[kind] ? sent[kind].damage / sent[kind].count : 0)
  const reset = () => {
    for (const kind of Object.keys(sent)) delete sent[kind]
  }

  // 손절: 매수벽의 남은 체력 절반을 버리고, 매도벽에 한 번 알린다(종류 stoploss).
  const before = (await market()).buyWall
  assert.equal((await market()).actives.stopLossPending, false)
  await cast('stopLoss')
  await expect.poll(async () => (await market()).actives.stopLossPending).toBe(false)
  await expect.poll(() => sent.stoploss?.count ?? 0, { timeout: 15000 }).toBe(1)
  const after = (await market()).buyWall
  assert.ok(after.hp <= before.maxHp * 0.75, `buy wall gave up health: ${after.hp}/${before.maxHp}`)
  assert.ok(after.hp > 0, 'the buy wall still stands')
  assert.ok(sent.stoploss.damage > 0)
  await page.screenshot({ path: '/tmp/new-actives-stoploss.png' })

  // 물타기: 도는 동안 매수 주문 한 장이 1.5배 넘게 세다. 매수 주문은 매도 물량과 상쇄하고 남은 것만 벽에 닿아 드물다: 닿을 때까지 기다린다.
  reset()
  await expect.poll(() => sent.buy?.count ?? 0, { timeout: 30000 }).toBeGreaterThan(0)
  const plainBuy = (await market()).buyOrder
  assert.ok(plainBuy > 0, 'buy orders have damage')
  await cast('averaging')
  await expect.poll(async () => (await market()).actives.averaging).toBeGreaterThan(0)
  const wall = (await market()).buyWall
  const boostedBuy = (await market()).buyOrder
  const expected = plainBuy * (1.5 + 1.5 * (1 - wall.hp / wall.maxHp))
  assert.ok(
    boostedBuy >= plainBuy * 1.5 && Math.abs(boostedBuy - expected) < plainBuy * 0.2,
    `averaging buy order ${boostedBuy} vs ${plainBuy}, wall ${wall.hp}/${wall.maxHp}`,
  )
  await page.screenshot({ path: '/tmp/new-actives-averaging.png' })

  // 상한가: 도는 동안 총알 한 발이 평소(치명타가 섞인 평균)보다 세다.
  await expect.poll(async () => (await market()).actives.averaging, { timeout: 40000 }).toBe(0)
  reset()
  await page.waitForTimeout(5000)
  const plainBullet = perHit('bullet')
  assert.ok(plainBullet > 0, 'bullets reach the wall')
  await cast('limitUp')
  await expect.poll(async () => (await market()).actives.limitUp).toBeGreaterThan(0)
  await page.waitForTimeout(1000)
  reset()
  await page.waitForTimeout(4000)
  const critBullet = perHit('bullet')
  assert.ok(critBullet > plainBullet * 1.3, `limit-up bullet ${critBullet} vs ${plainBullet}`)
  await page.screenshot({ path: '/tmp/new-actives-limitup.png' })

  // 손절의 연출 (592번): 움직임을 줄이지 않은 화면에서는 매수벽 반쪽을 떼어 던지고, 그것이 닿을 때 명중을 알린다.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.reload()
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.waitForTimeout(2500)
  reset()
  await cast('stopLoss')
  await expect
    .poll(async () => (await market()).buyWall.feedback.tossing, { intervals: [20] })
    .toBe(true)
  assert.equal(sent.stoploss, undefined, 'the hit waits for the thrown half to land')
  await page.screenshot({ path: '/tmp/new-actives-stoploss-toss.png' })
  await expect.poll(async () => (await market()).buyWall.feedback.tossing).toBe(false)
  await expect.poll(() => sent.stoploss?.count ?? 0, { timeout: 15000 }).toBe(1)

  assert.deepEqual(errors, [])
  console.log(
    `new actives ok: stop loss ${before.hp} -> ${after.hp} (hit ${sent.stoploss?.damage ?? 'sent'}), averaging x${(boostedBuy / plainBuy).toFixed(2)}, limit up x${(critBullet / plainBullet).toFixed(2)}`,
  )
} finally {
  await browser.close()
}
