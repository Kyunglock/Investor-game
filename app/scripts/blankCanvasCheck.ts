// 돌파 화면의 전장이 열리지 않을 때 (#836): 그림 하나가 끝나지 않으면 배경색만 남지 않고 불러오는 중임을 알리며,
// 스스로 다시 띄우다가 오류 문구와 "다시 시도"를 보이고, 그림이 오면 "다시 시도"로 전장이 열린다.
// 전투는 그림을 XHR로 다시 받지 않는다. 실행: pnpm dev 를 띄운 뒤 node scripts/blankCanvasCheck.ts
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const cats = [
  ['sky', '하늘냥'],
  ['mint', '민트냥'],
  ['lilac', '라일락냥'],
  ['sunset', '노을냥'],
].map(([code, name], i) => ({
  code,
  name,
  level: i < 2 ? 1 : 0,
  damagePercent: 50,
  firePercent: 100,
  criticalPercent: 100,
  fielded: i < 2,
  skills: [],
  skillLevel: 1,
  skillNextLevel: 10,
  grade: 'C',
  weapon: null,
}))
const company = {
  ...structuredClone(fixture),
  idle: {
    wall: 13,
    hp: 1200,
    maxHp: 1200,
    dps: 12,
    earned: 0,
    boss: false,
    circuitSeconds: 0,
    sequence: 0,
    upcoming: [],
    skills: [],
    fieldSlots: 4,
    rebirth: { count: 0, fish: 0, gain: 0, fromWall: 51 },
    wallDps: 0,
    power: 1038,
    income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
    offline: null,
    cats,
  },
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
let seq = 0
await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
  if (route.request().url().endsWith('/idle'))
    company.idle.sequence = route.request().postDataJSON().sequence
  ;(company as { capital?: number }).capital = 1000 + seq++
  await route.fulfill({ json: company })
})
// 전장 배경 그림이 끝나지 않는다: 실패도 성공도 아니다.
let hang = true
let xhrImages = 0
const held: (() => Promise<void>)[] = []
await page.route(/toy-arena.*\.png/, async (route) => {
  // 개발 서버는 그림의 주소를 알려 주는 모듈도 같은 이름으로 내준다: 그림만 붙잡는다.
  if (hang && route.request().resourceType() !== 'script') held.push(() => route.continue())
  else await route.continue()
})
page.on('request', (r) => {
  if (r.resourceType() === 'xhr' && /\.png/.test(r.url())) xhrImages++
})
try {
  // 끝나지 않는 그림이 있어 load 이벤트는 오지 않는다.
  await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/', { waitUntil: 'commit' })
  const loading = page.getByTestId('idle-canvas-loading')
  const failed = page.getByRole('alert').filter({ hasText: '전장 그림을 불러오지 못했어요' })
  await expect(loading).toBeVisible({ timeout: 60000 })
  await expect(failed).toBeHidden()
  // 스스로 두 번 다시 띄운 뒤에 알린다.
  await expect(failed).toBeVisible({ timeout: 60000 })
  await expect(loading).toBeHidden()
  hang = false
  await Promise.all(held.map((go) => go().catch(() => {})))
  await failed.getByRole('button', { name: '다시 시도' }).click()
  await expect(failed).toBeHidden()
  await expect(loading).toBeHidden({ timeout: 30000 })
  await expect(page.locator('[data-testid=idle-canvas] canvas')).toHaveCount(1)
  assert.equal(xhrImages, 0, '전투가 그림을 XHR로 다시 받았다')
  assert.deepEqual(errors, [])
  if (process.env.OUT) await page.screenshot({ path: `${process.env.OUT}/blank-canvas-after.png` })
  console.log('blankCanvasCheck ok')
} finally {
  await browser.close()
}
