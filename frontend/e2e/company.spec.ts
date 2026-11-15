import { type APIResponse, expect, test } from '@playwright/test'
import type { components } from '../src/api/schema.d.ts'

// 실제 서버·DB로 실시간 수입과 종목회의를 확인한다 (#803, decisions.md 523번). 게임 화면은 앱(/app/)에 있어, 여기서는 첫 화면만 보고 나머지는
// Vite 프록시(/api)를 거쳐 API를 직접 부른다. 새 브라우저 문맥은 새 세션이라 회사가 없고, 같은 문맥의 요청은 세션 쿠키를 함께 쓴다.

type Company = components['schemas']['Company']

test.setTimeout(60_000)

/** 성공한 응답의 회사. 실패면 서버가 말한 이유를 함께 보인다. */
async function companyOf(response: APIResponse): Promise<Company> {
  expect(response.ok(), `${response.url()} → ${response.status()} ${await response.text()}`).toBe(
    true,
  )
  return (await response.json()) as Company
}

test('첫 화면은 게임 이름과 앱 화면으로 가는 게임 시작을 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '흔들리지 않는 고양이' })).toBeVisible()
  const start = page.getByRole('link', { name: '게임 시작' })
  await expect(start).toBeVisible()
  await expect(start).toHaveAttribute('href', '/app/')
})

test('회사를 차려 뽑고 앉히면 1초마다 벌고, 기회를 써서 종목회의를 한다', async ({ page }) => {
  const api = page.request
  // 스토어의 open과 같은 순서: 세션을 만들고 회사를 차린다.
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  let company = await companyOf(await api.post('/api/company'))
  expect(company.employees).toHaveLength(0)
  expect(company.meetings.chances).toBe(1)

  // 채용권으로 뽑는다 (store.draw: 지금까지 뽑은 횟수를 함께 보낸다).
  const count = Math.min(company.gacha.tickets, company.gacha.maxDraws, company.seats)
  expect(count).toBeGreaterThanOrEqual(1)
  company = await companyOf(
    await api.post('/api/company/draws', { data: { count, draws: company.gacha.draws } }),
  )
  expect(company.employees).toHaveLength(count)

  // 뽑은 사람을 돈을 굴리는 자리에 앉힌다 (store.place).
  const trading = company.desks.filter((d) => d.trades)
  expect(trading.length).toBeGreaterThan(0)
  const seats = company.employees.map((e, i) => ({
    employeeId: e.id,
    desk: trading[i % trading.length].code,
  }))
  company = await companyOf(await api.post('/api/company/placement', { data: { seats } }))
  for (const e of company.employees) {
    expect(e.desk).not.toBeNull()
    expect(e.incomePerSecond).toBeGreaterThan(0)
  }
  expect(company.idle?.income.perSecond).toBeGreaterThan(0)

  // 화면을 보는 동안의 박자 (useIdleBattle: runId·sequence·action·hits). 시작하고 1초 남짓 뒤의 박자에 수입이 자본에 들어온다.
  const runId = crypto.randomUUID()
  let sequence = company.idle?.sequence ?? 0
  const started = await companyOf(
    await api.post('/api/company/idle', {
      data: { runId, sequence: ++sequence, action: 'start', hits: [] },
    }),
  )
  await page.waitForTimeout(1_200)
  company = await companyOf(
    await api.post('/api/company/idle', {
      data: { runId, sequence: ++sequence, action: 'tick', hits: [] },
    }),
  )
  expect(company.capital).toBeGreaterThan(started.capital)

  // 종목회의: 기회 하나를 써서 열고(직원이 종목을 물어 온다) 산다.
  const chances = company.meetings.chances
  expect(chances).toBeGreaterThanOrEqual(1)
  company = await companyOf(await api.post('/api/company/invest/open'))
  expect(company.invest?.convened).toBe(true)
  expect(company.invest?.outcome ?? null).toBeNull()
  expect(company.meetings.chances).toBe(chances - 1)
  company = await companyOf(await api.post('/api/company/invest', { data: { choice: 'BUY' } }))
  expect(company.invest?.outcome).toBeTruthy()
  expect(company.capital).toBeGreaterThanOrEqual(0)
  expect(company.meetings.chances).toBe(chances - 1)

  // 새 회사는 기회가 하나뿐이라 다음 회의는 열리지 않는다.
  expect(company.meetings.chances).toBe(0)
  expect((await api.post('/api/company/invest/open')).status()).toBe(400)
})

test('분기 넘기기는 없어졌다', async ({ page }) => {
  const api = page.request
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  await companyOf(await api.post('/api/company'))
  const settle = await api.post('/api/company/settle', { data: { year: 1, quarter: 1 } })
  expect(settle.status()).toBe(404)
})
