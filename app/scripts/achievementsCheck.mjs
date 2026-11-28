// 업적 (decisions.md 708번): 돌파 화면의 우승컵 단추에 받을 수가 뜨고, 시트에서 받으면 다이아가 들어오고 다음 단계로 간다.
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const company = structuredClone(fixture)
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    const claims = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/achievements/claim')) {
        claims.push(route.request().postDataJSON())
        const wall = company.achievements.list[0]
        company.diamonds.amount += wall.diamonds
        Object.assign(company.achievements, { ready: 0, lastDiamonds: wall.diamonds })
        Object.assign(wall, {
          tier: 1,
          title: '매도벽 최고 기록 50 돌파',
          target: 50,
          diamonds: 20,
          ready: false,
        })
      }
      return route.fulfill({ json: company })
    })
    await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
    const button = page.getByTestId('idle-achievements')
    await expect(button).toBeVisible({ timeout: 30000 })
    await expect(page.getByTestId('achievements-badge')).toHaveText('1')
    // 전투 통계 단추 바로 위에 서고 화면 안에 있다.
    const a = await button.boundingBox()
    const s = await page.getByTestId('idle-stats').boundingBox()
    assert(a && s, 'both shortcuts are shown')
    assert(a.y + a.height <= s.y + 1, 'the trophy sits above the stats key')
    assert(a.x + a.width <= width, 'the trophy stays on screen')
    await button.click()
    const sheet = page.getByTestId('achievements')
    await expect(sheet).toBeVisible()
    await expect(page.getByTestId('achievement')).toHaveCount(2)
    // 받을 것이 있는 업적이 위에 선다.
    const wall = page.locator('[data-testid=achievement][data-code=wall]')
    await expect(page.getByTestId('achievement').first()).toHaveAttribute('data-code', 'wall')
    await expect(wall).toContainText('매도벽 최고 기록 10 돌파')
    await expect(wall).toContainText('1/10단계')
    await expect(wall.getByTestId('achievement-claim')).toContainText('10')
    await expect(page.locator('[data-testid=achievement][data-code=draw]')).toContainText('3/10')
    await page.screenshot({ path: `/tmp/achievements-${width}.png` })
    await wall.getByTestId('achievement-claim').click()
    await expect(page.getByTestId('achievements-got')).toContainText('다이아 10개')
    assert.deepEqual(claims, [{ code: 'wall' }])
    await expect(wall).toContainText('매도벽 최고 기록 50 돌파')
    await expect(wall).toHaveAttribute('data-state', 'todo')
    await expect(page.getByTestId('achievements-claim-all')).toHaveCount(0)
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    await expect(page.getByTestId('achievements-badge')).toHaveCount(0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('achievements ok')
} finally {
  await browser.close()
}
