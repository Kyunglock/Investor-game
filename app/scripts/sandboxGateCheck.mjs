import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

/**
 * 테스트판의 코드 창 (decisions.md 642번): 테스트판 쿠키가 남지 않는 앱에서도 코드를 한 번 맞히면 다시 묻지 않는다. 서버를 흉내 내되
 * 쿠키는 한 번도 남기지 않고, 요청에 실린 코드 머리글만으로 테스트판 회사를 준다. 다시 켜도(새로 고침) 코드 창이 뜨지 않아야 한다.
 */
const idle = {
  wall: 3,
  hp: 100,
  maxHp: 100,
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
}
const main = { ...structuredClone(fixture), idle }
const trial = {
  ...structuredClone(fixture),
  companyId: '00000000-0000-0000-0000-0000000000aa',
  sandbox: true,
  sandboxInfinite: true,
  idle,
}
const CODE = 'cat-test'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  const served = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions|sandbox)(\/|$|\?)/, (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/sandbox' && request.method() === 'POST') {
      return request.postDataJSON().code === CODE
        ? route.fulfill({ json: trial })
        : route.fulfill({ status: 400, json: { message: '코드가 맞지 않다' } })
    }
    const inside = request.headers()['x-sandbox-code'] === CODE
    served.push(inside)
    return route.fulfill({ json: inside ? trial : main })
  })
  const url = new URL(process.env.APP_URL ?? 'http://localhost:5182/app/')
  url.searchParams.set('test', '1')
  await page.goto(url.href, { timeout: 90000 })
  const gate = page.locator('.idle-sandbox-gate')
  await expect(gate).toBeVisible({ timeout: 30000 })
  // 틀린 코드는 창에 남아 까닭을 적는다.
  await page.getByLabel('테스트판 코드').fill('nope')
  await page.getByRole('button', { name: '들어가기' }).click()
  await expect(gate.getByRole('alert')).toContainText('코드가 맞지 않아요')
  // 맞는 코드: 창이 닫히고, 쿠키가 없어도 그 뒤의 요청이 모두 테스트판으로 간다.
  await page.getByLabel('테스트판 코드').fill(CODE)
  await page.getByRole('button', { name: '들어가기' }).click()
  await expect(gate).toHaveCount(0)
  served.length = 0
  await page.waitForTimeout(4000)
  await expect(gate).toHaveCount(0)
  assert.ok(served.length > 0, '테스트판에 들어간 뒤의 요청이 없다')
  assert.ok(served.every(Boolean), '코드 머리글 없이 나간 요청이 있다')
  // 다시 켠다: 첫 요청부터 코드를 실어 코드 창이 뜨지 않는다.
  served.length = 0
  await page.reload()
  await expect(page.getByTestId('idle-canvas-loading')).toHaveCount(0, { timeout: 30000 })
  await page.waitForTimeout(3000)
  await expect(gate).toHaveCount(0)
  assert.ok(
    served.length > 0 && served.every(Boolean),
    '다시 켠 뒤 코드 머리글 없이 나간 요청이 있다',
  )
  // "본 게임으로" 나오면 코드를 싣지 않고, 코드 창도 다시 뜨지 않는다.
  await page
    .getByRole('button', { name: /테스트판/ })
    .first()
    .click()
  await page.getByRole('button', { name: '본 게임으로' }).click()
  await expect(page.getByTestId('idle-sandbox-enter')).toBeVisible()
  served.length = 0
  await page.waitForTimeout(3000)
  await expect(gate).toHaveCount(0)
  assert.ok(served.length > 0 && !served.some(Boolean), '나온 뒤에도 코드 머리글이 실렸다')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
console.log('sandbox gate check passed')
