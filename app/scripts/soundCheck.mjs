// 효과음 파일(decisions.md 605번)이 브라우저에서 모두 받아지고 풀리는지 확인한다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start
    window.sampleStarts = 0
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.sampleStarts++
      return start.apply(this, args)
    }
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  // 첫 터치에 오디오가 깨어나고 파일을 받는다.
  const status = () =>
    page.evaluate(async () => (await import('/app/src/fx/sound.ts')).soundStatus())
  const playing = () => status().then((s) => s.musicPlaying)
  assert.equal(await playing(), false)
  await page.mouse.click(195, 300)
  await expect.poll(async () => (await status()).loaded, { timeout: 15000 }).toBe(12)
  assert.equal((await status()).total, 12)
  await expect.poll(playing).toBe(true)
  // 낼 때 오류가 없다.
  await page.evaluate(async () => {
    const { sfx } = await import('/app/src/fx/sound.ts')
    for (const play of Object.values(sfx)) play()
  })
  assert.ok(await page.evaluate(() => window.sampleStarts > 0))
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setMuted(true))
  await expect.poll(playing).toBe(false)
  await page.reload()
  await page.keyboard.press('Tab')
  assert.equal(await playing(), false)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setMuted(false))
  await expect.poll(playing).toBe(true)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setHushed(true))
  await expect.poll(playing).toBe(false)
  const pausedAt = (await status()).musicTime
  await page.waitForTimeout(300)
  assert.equal((await status()).musicTime, pausedAt)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setHushed(false))
  await expect.poll(playing).toBe(true)
  for (const active of [false, true]) {
    await page.evaluate(
      (detail) => window.dispatchEvent(new CustomEvent('idle-app-active', { detail })),
      active,
    )
    await expect.poll(playing).toBe(active)
  }
  assert.deepEqual(errors, [])
  console.log(
    'sound ok: BGM playback, mute persistence, power save, native background and 12 decoded foley samples',
  )
} finally {
  await browser.close()
}
