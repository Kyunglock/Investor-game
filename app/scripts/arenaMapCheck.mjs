// APP_URL의 실제 전투를 띄워 50벽 경계·순환·재접속 시 두 배경 타일을 확인한다.
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
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/idle')) {
      company.idle.sequence = route.request().postDataJSON().sequence
    }
    await route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  const map = () => page.evaluate(() => window.__mentalMarket?.().arena)
  for (const [wall, key] of [
    [1, 'toy-city'],
    [50, 'toy-city'],
    [51, 'neon-street'],
    [100, 'neon-street'],
    [101, 'candy-factory'],
    [150, 'candy-factory'],
    [151, 'space-station'],
    [200, 'space-station'],
    [201, 'glasshouse'],
    [251, 'moonlit-harbor'],
    [301, 'honey-bakery'],
    [351, 'pearl-aquarium'],
    [401, 'star-observatory'],
    [451, 'blossom-garden'],
    [501, 'snow-rink'],
    [551, 'toy-city'],
    [51, 'neon-street'],
  ]) {
    company.idle.wall = wall
    company.idle.boss = wall % 50 === 0
    await expect(page.getByTestId('idle-wall-number')).toHaveText(
      new RegExp(`^(매도벽|보스) ${wall}$`),
      {
        timeout: 30000,
      },
    )
    await expect.poll(map, { timeout: 15000 }).toEqual({ front: key, back: key })
    if ([1, 51, 101, 151, 201, 251].includes(wall)) {
      await page.screenshot({ path: `/tmp/arena-map-${key}.png` })
    }
  }
  company.idle.wall = 151
  company.idle.boss = false
  await page.reload()
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await expect
    .poll(map, { timeout: 30000 })
    .toEqual({ front: 'space-station', back: 'space-station' })
  await page.setViewportSize({ width: 320, height: 740 })
  await expect.poll(map).toEqual({ front: 'space-station', back: 'space-station' })
  assert.deepEqual(errors, [])
  console.log(
    'arena maps ok: boundaries, 550-wall cycle, saved progress, reload, resize, both tiles',
  )
} finally {
  await browser.close()
}
