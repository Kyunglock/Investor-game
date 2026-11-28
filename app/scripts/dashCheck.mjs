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
  // CPU_SLOW=4처럼 주면 그만큼 느린 기계를 흉내 낸다: CI의 기계에서도 판정이 흔들리지 않는지 볼 때 쓴다.
  if (process.env.CPU_SLOW) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_SLOW) })
  }
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
  const most = (key) => Math.max(...samples.map((x) => x[key]))
  return {
    perSecond: (s.wall - from) / seconds,
    momentum: mean('momentum'),
    pace: mean('pace'),
    climbV: mean('climbV'),
    // 평균은 기계의 빠르기를 탄다(느린 기계는 벽이 덜 자주 깨진다): 판정은 그동안 닿은 값으로 한다.
    quickest: Math.min(...samples.map((x) => x.pace)),
    topMomentum: most('momentum'),
    topGround: most('climbV'),
  }
}

// 한 번의 진행 동기화에 열두 벽이 넘어가도 이륙하고, 다음 벽에 막히면 제자리로 돌아온다.
async function checkFlight(browser) {
  let wall = 43
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  })
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({
      json: {
        ...company,
        idle: {
          ...idle,
          wall,
          hp: 1e9,
          maxHp: 1e9,
          sequence: route.request().postDataJSON()?.sequence ?? 0,
          boss: false,
          upcoming: [],
        },
      },
    }),
  )
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.waitForFunction(() => window.__mentalMarket?.().arena.front === 'toy-city')
  const groundY = await page.evaluate(() => window.__mentalMarket().stand.y)
  wall += 12
  await page.waitForFunction(
    (y) => {
      const m = window.__mentalMarket()
      return m.flight > 0.6 && m.stand.y < y - 10 && m.groundV > 900
    },
    groundY,
    { timeout: 15000 },
  )
  await page.screenshot({ path: '/tmp/wall-flight-390.png' })
  await page.waitForFunction((y) => {
    const m = window.__mentalMarket()
    return (
      !m.flight &&
      Math.abs(m.stand.y - y) < 1 &&
      m.arena.front === 'neon-street' &&
      m.arena.back === 'neon-street'
    )
  }, groundY)
  await page.close()
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  // 한 방에 부서지는 벽: 다음 벽이 가장 빠르게 넘어오고, 기세가 가득 차며, 배경이 달리기(620px/초)보다 빠르게 흐른다.
  await checkFlight(browser)
  const strong = await run(browser, 0.5, 8)
  assert.ok(strong.quickest <= 0.25, `walls follow at once: pace ${strong.quickest}`)
  assert.ok(strong.topMomentum > 0.8, `the dash fills: momentum ${strong.topMomentum}`)
  assert.ok(strong.topGround > 900, `the ground rushes by: ${strong.topGround} px/s`)
  assert.ok(strong.perSecond > 1, `walls fall fast: ${strong.perSecond}/s`)
  // 총알 여러 발이 필요한 벽: 기세가 한 번도 차지 않고 벽 앞에서는 배경이 멈춘다.
  // 매수 주문이 시장가 매도만큼 세지고 세 장씩 나가면서 (711·712번) 체력 40인 벽은 매수 주문 두 묶음에 깨져 기세가 찼다.
  // 느린 벽은 체력을 넉넉히 줘 매수 주문으로도 몇 초가 걸리게 한다.
  const even = await run(browser, 4000, 8)
  assert.ok(even.topMomentum < 0.05, `no dash on a slow wall: momentum ${even.topMomentum}`)
  assert.ok(even.climbV < 200, `the ground stands still at the wall: ${even.climbV} px/s`)
  const text = (r) =>
    `${r.perSecond.toFixed(2)} walls/s, pace ${r.pace.toFixed(2)}, momentum ${r.momentum.toFixed(2)}, ground ${Math.round(r.climbV)} px/s`
  console.log(`dash ok: strong ${text(strong)} | even ${text(even)}`)
} finally {
  await browser.close()
}
