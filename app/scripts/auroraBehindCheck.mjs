// 극광의 밤은 뒤 매도벽도 친다 (decisions.md 673번): 자동 전투에서 극광냥의 장막이 맨 앞 벽을 칠 때 뒤에 보이는 벽들도 절반·4분의 1의
// 피해로 함께 맞고, 그 명중이 서버로 가는 길(idle-wall-hit)에 실린다. 개발 서버에서만 돈다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const company = structuredClone(fixture)
  company.idle = {
    wall: 1,
    hp: 1e9,
    maxHp: 1e9,
    dps: 0,
    earned: 0,
    boss: false,
    circuitSeconds: 0,
    sequence: 0,
    upcoming: [
      { wall: 2, hp: 1e9, maxHp: 1e9 },
      { wall: 3, hp: 1e9, maxHp: 1e9 },
    ],
    skills: [],
    fieldSlots: 4,
    bossFielded: true,
    wallDps: 0,
    power: 1,
    income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
    offline: null,
    lastDraws: [],
    actives: [],
    cats: [
      {
        code: 'aurora',
        name: '극광냥',
        level: 1,
        damagePercent: 100,
        firePercent: 100,
        criticalPercent: 100,
        fielded: true,
        slot: 0,
        skills: [{ code: 'auroraNight', name: '극광의 밤' }],
        skillLevel: 1,
        skillNextLevel: 10,
        grade: 'S',
        weapon: null,
      },
    ],
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.__auroraHits = []
    window.addEventListener('idle-wall-hit', (event) => {
      if (event.detail.kind === 'auroraNight') window.__auroraHits.push(event.detail)
    })
  })
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.locator('[data-testid=idle-canvas] canvas').waitFor()
  await page.evaluate(() => window.__mentalSpeed?.(4))
  const depths = () =>
    page.evaluate(() => [0, 1, 2].map((d) => window.__auroraHits.filter((h) => h.depth === d)))
  await expect
    .poll(async () => (await depths()).map((hits) => hits.length > 0), { timeout: 60000 })
    .toEqual([true, true, true])
  const [front, next, far] = await depths()
  // 맨 앞 벽을 칠 때마다 뒤의 두 벽도 함께 맞는다: 벽 번호는 하나씩 뒤, 피해는 절반씩.
  assert.equal(front[0].wall, 1)
  assert.equal(next[0].wall, 2)
  assert.equal(far[0].wall, 3)
  assert.ok(Math.abs(next[0].damage / front[0].damage - 0.5) < 1e-6, 'half on the next wall')
  assert.ok(Math.abs(far[0].damage / front[0].damage - 0.25) < 1e-6, 'a quarter on the far wall')
  await page.screenshot({ path: '/tmp/aurora-behind.png' })
  assert.deepEqual(errors, [])
  console.log('극광의 밤 390px: 뒤 매도벽 둘도 절반·4분의 1로 맞는다')
} finally {
  await browser.close()
}
