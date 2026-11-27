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
    window.musicStarts = 0
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (this.loop) window.musicStarts++
      return play.call(this)
    }
    window.sampleStarts = 0
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.sampleStarts++
      return start.apply(this, args)
    }
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.getByTestId('shell').waitFor()
  // 첫 터치에 오디오가 깨어나고 파일을 받는다.
  const status = () =>
    page.evaluate(async () => (await import('/app/src/fx/sound.ts')).soundStatus())
  const plays = (key) =>
    page.evaluate(async (key) => {
      const { sfx } = await import('/app/src/fx/sound.ts')
      const before = window.sampleStarts
      sfx[key]()
      return window.sampleStarts > before
    }, key)
  const loaded = () => expect.poll(async () => (await status()).loaded).toBe(15)
  await page.mouse.click(195, 300)
  await loaded()
  for (const key of ['shot', 'cast', 'zap', 'boom']) await expect.poll(() => plays(key)).toBe(true)
  assert.equal(await page.evaluate(() => window.musicStarts), 0)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setMuted(true))
  assert.equal(await plays('tap'), false)
  await page.reload()
  await page.getByTestId('shell').waitFor()
  await page.keyboard.press('Tab')
  assert.equal(
    await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).isMuted()),
    true,
  )
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setMuted(false))
  await loaded()
  await expect.poll(() => plays('tap')).toBe(true)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setHushed(true))
  assert.equal(await plays('cast'), false)
  await page.evaluate(async () => (await import('/app/src/fx/sound.ts')).setHushed(false))
  await expect.poll(() => plays('cast')).toBe(true)
  for (const active of [false, true]) {
    await page.evaluate(
      (detail) => window.dispatchEvent(new CustomEvent('idle-app-active', { detail })),
      active,
    )
    await expect.poll(() => plays('zap')).toBe(active)
  }
  assert.equal(await page.evaluate(() => window.musicStarts), 0)
  assert.deepEqual(errors, [])
  console.log('sound ok: combat effects, mute persistence, power save and native background')
} finally {
  await browser.close()
}
