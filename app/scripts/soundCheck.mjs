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
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  // 첫 터치에 오디오가 깨어나고 파일을 받는다.
  await page.mouse.click(195, 300)
  const status = () =>
    page.evaluate(async () => (await import('/app/src/fx/sound.ts')).soundStatus())
  await expect.poll(async () => (await status()).loaded, { timeout: 15000 }).toBe(14)
  assert.equal((await status()).total, 14)
  // 낼 때 오류가 없다.
  await page.evaluate(async () => {
    const { sfx } = await import('/app/src/fx/sound.ts')
    for (const play of Object.values(sfx)) play()
  })
  await page.waitForTimeout(300)
  assert.deepEqual(errors, [])
  console.log('sound ok: 14 files decoded, every effect plays')
} finally {
  await browser.close()
}
