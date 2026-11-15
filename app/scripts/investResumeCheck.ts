/// <reference lib="dom" />
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

/**
 * 종목회의 흐름 (#803): 이슈 탭의 회의 칸에서 기회 하나를 써서 연다 → 도중에 나갔다가(새로 고침 포함) 이어서 한다 → 고르고 확인을 누르면 창만
 * 닫힌다(결산 요청은 없다) → 기회가 떨어지면 기다린다 → 서버가 거절하면 까닭을 보인다. 서버 없이 /api를 가짜 회사로 막는다.
 */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
const idle = {
  wall: 1,
  hp: 120,
  maxHp: 120,
  dps: 12,
  earned: 0,
  boss: false,
  circuitSeconds: 0,
  upcoming: [],
  skills: [],
  fieldSlots: 4,
  wallDps: 0,
  power: 1038,
  income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
  offline: null,
  cats: [],
}
try {
  for (const width of [320, 390]) {
    const outcome = {
      choice: 'BUY',
      big: false,
      delegated: false,
      teamBuy: 0,
      teamSell: 0,
      debate: [],
      up: true,
      reveal: '실적이 올랐다',
      decisive: 0,
      total: 1000000,
      returnBp: 1000,
      gainBp: 1000,
      lossBp: -1000,
      battle: null,
      results: [],
      reactions: [],
    }
    const meeting = () => ({
      title: '신제품 출시',
      sector: 'semiconductor',
      sectorName: '반도체',
      stockName: '테스트전자',
      range: { lossBp: -1000, gainBp: 1000 },
      scouted: true,
      sentences: [{ text: '실적이 올랐다', highlighted: false }],
      sway: { who: '동료', text: '좋아 보여요' },
      remarks: [],
      options: [
        { code: 'BUY', label: '산다' },
        { code: 'SELL', label: '판다' },
      ],
      ready: true,
      convened: true,
      outcome: null as typeof outcome | null,
    })
    const company = {
      ...structuredClone(fixture),
      idle,
      meetings: { chances: 2, max: 3, nextSeconds: 1500 },
      invest: null as ReturnType<typeof meeting> | null,
    }
    let opens = 0
    let decisions = 0
    let reject: string | null = null
    const posts: string[] = []
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    const errors: string[] = []
    page.setDefaultTimeout(15000)
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() === 'POST') {
        posts.push(path)
        if (path.endsWith('/invest/open')) {
          if (reject) return route.fulfill({ status: 400, json: { message: reject } })
          // 정하지 않은 회의가 있으면 기회를 쓰지 않고 그 회의를 돌려준다.
          if (!company.invest || company.invest.outcome) {
            company.meetings.chances--
            company.invest = meeting()
            opens++
          }
        } else if (path.endsWith('/invest') && company.invest) {
          company.invest.outcome = outcome
          company.invest.ready = false
          decisions++
        }
      }
      return route.fulfill({ json: company })
    })
    const toIssue = async () => {
      await page.getByTestId('idle-battle').waitFor({ timeout: 30000 })
      await page.getByRole('button', { name: /^회사( 종목회의 가능| EX 디펜스 가능)?$/ }).click()
      await page.getByTestId('tab-issue').click()
      await expect(page.getByTestId('meeting-open')).toBeVisible()
    }
    const button = page.getByTestId('meeting-open')
    await page.goto(process.env.APP_URL ?? 'http://localhost:5173/app/')
    // 열 수 있으면 메인 화면의 회사 메뉴와 이슈 탭에 표가 붙는다. 분기 넘기기 버튼은 어디에도 없다.
    await expect(page.getByTestId('meeting-dot')).toBeVisible({ timeout: 30000 })
    await toIssue()
    await expect(page.getByTestId('tab-issue')).toContainText('!')
    await expect(page.getByTestId('settle')).toHaveCount(0)
    await expect(page.getByTestId('meeting-chances')).toHaveText('2 / 3')
    await expect(page.getByTestId('meeting-next')).toHaveText(/다음 기회까지 \d+:\d\d/)
    await expect(button).toHaveText('종목회의 열기')
    // 기회 하나를 써서 연다.
    await button.click()
    await expect(page.getByTestId('invest')).toBeVisible()
    assert.equal(opens, 1)
    // 정하지 않고 나가면 이어서 할 수 있고, 기회는 다시 쓰지 않는다.
    await page.getByRole('button', { name: '나중에 정하기' }).click()
    await expect(page.getByTestId('invest')).toHaveCount(0)
    await expect(button).toHaveText('종목회의 이어서 하기')
    await expect(page.getByTestId('meeting-chances')).toHaveText('1 / 3')
    await page.reload()
    await toIssue()
    await expect(button).toHaveText('종목회의 이어서 하기')
    await button.click()
    await expect(page.getByTestId('invest')).toBeVisible()
    assert.equal(opens, 1, 'continuing a meeting spends no chance')
    assert.equal(posts.filter((p) => p.endsWith('/invest/open')).length, 1)
    // 고르고 확인을 누르면 창만 닫힌다.
    await page.getByTestId('invest-to-decide').click()
    await page.locator('[data-choice="BUY"]').click()
    await expect(page.getByTestId('invest-settle')).toBeVisible({ timeout: 30000 })
    await expect(page.getByTestId('invest-settle')).toHaveText('확인')
    await page.getByTestId('invest-settle').click()
    await expect(page.getByTestId('invest')).toHaveCount(0)
    assert.equal(decisions, 1)
    assert.equal(posts.filter((p) => p.endsWith('/settle')).length, 0, 'no settle request')
    // 정한 회의는 결과로 남을 뿐이라 다시 열 수 있다. 서버가 거절하면 까닭을 보이고 창은 뜨지 않는다.
    await expect(button).toHaveText('종목회의 열기')
    reject = '종목회의를 열 기회가 없습니다.'
    await button.click()
    await expect(page.getByRole('alert')).toHaveText(reject)
    await expect(page.getByTestId('invest')).toHaveCount(0)
    reject = null
    // 마지막 기회를 쓰고 정하면 기다리는 상태가 된다: 버튼이 잠기고 표가 사라진다.
    await button.click()
    await expect(page.getByTestId('invest')).toBeVisible()
    assert.equal(opens, 2)
    await page.getByTestId('invest-to-decide').click()
    await page.locator('[data-choice="BUY"]').click()
    await expect(page.getByTestId('invest-settle')).toBeVisible({ timeout: 30000 })
    await page.getByTestId('invest-settle').click()
    await expect(page.getByTestId('meeting-chances')).toHaveText('0 / 3')
    await expect(button).toHaveText('기회를 기다리는 중')
    await expect(button).toBeDisabled()
    await expect(page.getByTestId('meeting-next')).toHaveText(/다음 기회까지 \d+:\d\d/)
    await expect(page.getByTestId('tab-issue')).not.toContainText('!')
    // 돈을 굴리는 자리가 비면 기회가 있어도 열 수 없다.
    company.meetings.chances = 3
    company.meetings.nextSeconds = 0
    for (const e of company.employees) e.desk = 'research'
    await expect(page.getByTestId('meeting-hint')).toBeVisible()
    await expect(button).toBeDisabled()
    await expect(page.getByTestId('meeting-next')).toHaveCount(0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
    assert.deepEqual(errors, [])
    console.log(
      `PASS ${width}: open, leave, reload, continue, decide, close, reject, wait, no desk`,
    )
    await page.close()
  }
} finally {
  await browser.close()
}
