// 질주의 기세 (decisions.md 606·608번): 벽을 한 방에 부술 만큼 세면 다음 벽이 곧바로 나오고 고양이들이 달리며 배경이 빠르게 흐른다.
// 총알 여러 발이 필요한 벽에서는 전과 같다.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const idle = {
  dps: 12,
  earned: 0,
  skills: [],
  cats: [],
  fieldSlots: 4,
  wallDps: 0,
  power: 1038,
  income: { perSecond: 1, staffPerSecond: 0, bonusPercent: 0 },
  offline: null,
}

/** 벽의 체력이 hp인 가짜 서버로 seconds초 싸우고, 그동안의 기세·넘어가는 빠르기·배경 빠르기와 깬 벽 수를 잰다. */
async function run(browser, hp, seconds) {
  const s = { wall: 1, damage: 0, sequence: 0 }
  const view = () => ({
    wall: s.wall,
    hp: Math.max(0, hp - s.damage),
    maxHp: hp,
    circuitSeconds: 0,
    sequence: s.sequence,
    boss: false,
    upcoming: [0, 1].map((i) => ({ wall: s.wall + 1 + i, hp, maxHp: hp })),
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (route.request().url().endsWith('/idle')) {
      const body = route.request().postDataJSON()
      if (body.sequence >= s.sequence) {
        s.sequence = body.sequence
        for (const hit of body.hits ?? []) if ((hit.depth ?? 0) === 0) s.damage += hit.damage
        while (s.damage + 1e-7 >= hp) {
          s.damage -= hp
          s.wall++
        }
      }
    }
    return route.fulfill({ json: { ...company, idle: { ...idle, ...view() } } }).catch(() => {})
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.waitForTimeout(2500)
  const from = s.wall
  const samples = []
  const until = Date.now() + seconds * 1000
  while (Date.now() < until) {
    samples.push(
      await page.evaluate(() => {
        const m = window.__mentalMarket()
        return { momentum: m.momentum, pace: m.idlePace, climbV: m.groundV }
      }),
    )
    await page.waitForTimeout(100)
  }
  await page.screenshot({ path: `/tmp/dash-${hp}.png` })
  await page.close()
  assert.deepEqual(errors, [])
  const mean = (key) => samples.reduce((sum, x) => sum + x[key], 0) / samples.length
  return {
    perSecond: (s.wall - from) / seconds,
    momentum: mean('momentum'),
    pace: mean('pace'),
    climbV: mean('climbV'),
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  // 한 방에 부서지는 벽: 기세가 차 있고 배경이 빠르게 흐른다.
  const strong = await run(browser, 0.5, 8)
  assert.ok(strong.pace < 0.5, `walls follow at once: pace ${strong.pace}`)
  assert.ok(strong.momentum > 0.3, `the dash holds: momentum ${strong.momentum}`)
  assert.ok(strong.climbV > 450, `the ground rushes by: ${strong.climbV} px/s`)
  assert.ok(strong.perSecond > 5, `walls fall fast: ${strong.perSecond}/s`)
  // 총알 여러 발이 필요한 벽: 기세가 없고 벽 앞에서는 배경이 멈춘다.
  const even = await run(browser, 40, 8)
  assert.ok(even.momentum < 0.05, `no dash on a slow wall: momentum ${even.momentum}`)
  assert.ok(even.climbV < 200, `the ground stands still at the wall: ${even.climbV} px/s`)
  const text = (r) =>
    `${r.perSecond.toFixed(2)} walls/s, pace ${r.pace.toFixed(2)}, momentum ${r.momentum.toFixed(2)}, ground ${Math.round(r.climbV)} px/s`
  console.log(`dash ok: strong ${text(strong)} | even ${text(even)}`)
} finally {
  await browser.close()
}
