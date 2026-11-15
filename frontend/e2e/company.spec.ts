import { type APIResponse, expect, test } from '@playwright/test'
import type { components } from '../src/api/schema.d.ts'

// 실제 서버·DB로 자동 배치와 실시간 수입, 종목회의를 확인한다 (#801, #803, decisions.md 523·524번). 게임 화면은 앱(/app/)에 있어, 여기서는 첫 화면만 보고 나머지는
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

test('회사를 차려 뽑으면 바로 앉아 1초마다 벌고, 기회를 써서 종목회의를 한다', async ({ page }) => {
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

  // 뽑힌 사람은 서버가 바로 자리에 앉힌다 (#801): 사장이 배치하지 않는다. 첫 직원은 돈을 굴리는 자리에 앉아 종목회의를 열 수 있다.
  const trading = new Set(company.desks.filter((d) => d.trades).map((d) => d.code))
  expect(trading.size).toBeGreaterThan(0)
  expect(trading.has(company.employees[0].desk ?? '')).toBe(true)
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

test('배치·팀장·내보내기는 없어졌다 (#801)', async ({ page }) => {
  const api = page.request
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  let company = await companyOf(await api.post('/api/company'))
  company = await companyOf(
    await api.post('/api/company/draws', { data: { count: 1, draws: company.gacha.draws } }),
  )
  const [first] = company.employees
  expect(first.desk).not.toBeNull()
  const desk = first.desk ?? ''
  const placement = await api.post('/api/company/placement', {
    data: { seats: [{ employeeId: first.id, desk: null }] },
  })
  expect(placement.status()).toBe(404)
  const leader = await api.post('/api/company/leader', { data: { desk, employeeId: first.id } })
  expect(leader.status()).toBe(404)
  const release = await api.post('/api/company/release', { data: { employeeId: first.id } })
  expect(release.status()).toBe(404)
  // 아무것도 바뀌지 않았다: 그 직원이 그 자리에 그대로 있다.
  const after = await companyOf(await api.get('/api/company'))
  expect(after.employees.map((e) => [e.id, e.desk])).toEqual([[first.id, desk]])
})

test('자리가 꽉 차면 더 뽑을 수 없다 (#801)', async ({ page }) => {
  const api = page.request
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  let company = await companyOf(await api.post('/api/company'))
  // 새 회사의 자리는 넷이고, 데리고 있을 수 있는 수(rosterMax)는 자리 수와 같다.
  expect(company.seats).toBe(4)
  expect(company.gacha.rosterMax).toBe(company.seats)

  // 채용권과 한 번에 뽑는 수가 허락하는 만큼 자리를 채운다.
  while (company.employees.length < company.seats) {
    const count = Math.min(
      company.gacha.tickets,
      company.gacha.maxDraws,
      company.seats - company.employees.length,
    )
    if (count < 1) break
    const before = company.employees.length
    company = await companyOf(
      await api.post('/api/company/draws', { data: { count, draws: company.gacha.draws } }),
    )
    expect(company.employees).toHaveLength(before + count)
  }
  expect(company.gacha.roster).toBe(company.employees.length)
  expect(company.employees.length).toBeLessThanOrEqual(company.seats)
  for (const e of company.employees) {
    expect(e.desk).not.toBeNull()
  }

  // 자리를 넘겨 뽑으면 400이다. 채용권이 모자라면 자리 때문에 거절된 것인지 가릴 수 없으므로, 넘길 만큼 채용권이 남았을 때만 확인한다.
  const over = company.seats - company.employees.length + 1
  if (company.gacha.tickets < over || over > company.gacha.maxDraws) {
    test.info().annotations.push({
      type: 'skip-over-limit',
      description: `채용권 ${company.gacha.tickets}장으로는 자리(${company.seats})를 넘겨 뽑을 수 없다`,
    })
    return
  }
  const refused = await api.post('/api/company/draws', {
    data: { count: over, draws: company.gacha.draws },
  })
  expect(refused.status()).toBe(400)
  const body = (await refused.json()) as { message?: string }
  expect(body.message ?? '').toContain('회사를 넓히면 더 뽑을 수 있어요')
  // 거절되면 직원도 채용권도 그대로다.
  const after = await companyOf(await api.get('/api/company'))
  expect(after.employees).toHaveLength(company.employees.length)
  expect(after.gacha.tickets).toBe(company.gacha.tickets)
})
