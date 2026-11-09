/// <reference lib="dom" />
/**
 * 확장 연출의 프레임 재기 (#586): 실제 앱(개발 서버) + 가짜 API로 건물을 다섯 번 키우며, 연출(힘 모으기 → 쾅 → 밀어내기 → 축하)과 사무실로 돌아와 새
 * 라이벌이 서는 동안의 프레임 간격을 잰다. CPU를 CPU_SLOWDOWN배(기본 4) 느리게 해 저사양 휴대폰을 흉내 낸다. 프레임 수·평균 fps·가장 긴 프레임·
 * 33ms(30fps)를 넘긴 프레임 수를 적는다. `pnpm dev --port 5182` 뒤 `node scripts/moveFps.ts`. APP_URL/BROWSER_CHANNEL/CHROMIUM_PATH 지원.
 */
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const slowdown = Number(process.env.CPU_SLOWDOWN ?? 4)
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
type Frames = { count: number; fps: number; worst: number; slow: number }
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
  let company = {
    ...structuredClone(fixture),
    grade: 'F',
    seats: 4,
    capital: 10_000_000_000,
    lastSettlement: null,
    mental: null,
    upgrade: {
      to: 'E',
      cost: 100_000_000,
      needed: 200_000_000,
      affordable: true,
      years: 0,
      left: null as number | null,
    },
  }
  let step = 0
  const grades = ['E', 'D', 'C', 'B', 'A']
  const capacities = [6, 10, 14, 18, 22]
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (route.request().url().endsWith('/upgrade')) {
      company = {
        ...company,
        grade: grades[step],
        seats: capacities[step],
        upgrade: { ...company.upgrade, to: grades[step + 1] ?? 'S', years: 0, left: null },
      }
      step++
    }
    return route.fulfill({ json: company })
  })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
  await expect(page.getByTestId('office-scene')).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown })

  /** 프레임 간격을 모으기 시작한다. stop()이 결과를 돌려준다. */
  const start = () =>
    page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean }
      w.__frames = []
      w.__stop = false
      let last = performance.now()
      const tick = (now: number) => {
        w.__frames.push(now - last)
        last = now
        if (!w.__stop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  const stop = (): Promise<Frames> =>
    page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean }
      w.__stop = true
      const f = w.__frames.slice(1)
      const total = f.reduce((a, b) => a + b, 0)
      return {
        count: f.length,
        fps: Math.round((f.length / total) * 1000 * 10) / 10,
        worst: Math.round(Math.max(...f)),
        slow: f.filter((d) => d > 34).length,
      }
    })

  const rows: string[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('open-upgrade').click()
    await start()
    await page.getByTestId('upgrade').click()
    const move = page.getByTestId('move-scene')
    await expect(move).toBeVisible()
    await expect(move.getByTestId('toy-street')).toHaveAttribute('data-phase', '4', {
      timeout: 20_000,
    })
    await page.waitForTimeout(300)
    const grow = await stop()
    await start()
    await move.getByRole('button', { name: '사무실로' }).click()
    await expect(move).toBeHidden()
    await page.waitForTimeout(2000)
    const rise = await stop()
    rows.push(
      `| ${grades[i]} | ${grow.count} | ${grow.fps} | ${grow.worst} | ${grow.slow} | ${rise.fps} | ${rise.worst} | ${rise.slow} |`,
    )
  }
  console.log(`CPU ${slowdown}배 느리게, 390×844 @2x`)
  console.log(
    '| 오른 등급 | 연출 프레임 | 연출 fps | 가장 긴 프레임(ms) | 34ms 넘은 프레임 | 라이벌 fps | 가장 긴(ms) | 34ms 넘은 |',
  )
  console.log('|---|---|---|---|---|---|---|---|')
  for (const r of rows) console.log(r)
} finally {
  await browser.close()
}
