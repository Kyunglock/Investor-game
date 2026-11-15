import { type APIResponse, expect, test } from '@playwright/test'
import type { components } from '../src/api/schema.d.ts'

// 실제 서버·DB로 자동 배치와 실시간 수입, 종목회의를 확인한다 (#801, #803, decisions.md 523·524번). 게임 화면은 앱(/app/)에 있어, 여기서는 첫 화면만 보고 나머지는
// Vite 프록시(/api)를 거쳐 API를 직접 부른다. 새 브라우저 문맥은 새 세션이라 회사가 없고, 같은 문맥의 요청은 세션 쿠키를 함께 쓴다.
// 뽑기는 다이아로 한다 (#790, decisions.md 526번): 새 회사는 다이아 1,000개로 시작하고, 테스트마다 새 회사라 서로의 다이아를 쓰지 않는다.

type Company = components['schemas']['Company']

/** 새 회사가 받는 다이아 (526번). */
const START_DIAMONDS = 1000

/** 가진 다이아로 뽑을 수 있는 직원 수. */
const affordable = (company: Company) => Math.floor(company.diamonds.amount / company.diamonds.hire)

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
  // 새 회사는 다이아 1,000개로 시작한다 (526번).
  expect(company.diamonds.amount).toBe(START_DIAMONDS)
  expect(company.diamonds.hire).toBeGreaterThan(0)
  // 다이아 미션 (527번): 첫 스테이지의 별 셋에 100, EX 디펜스는 하루 한 번 300.
  expect(company.stages?.diamondsLeft[0]).toBe(100)
  expect(company.stages?.exDiamonds).toBe(300)

  // 다이아로 뽑는다 (store.draw: 지금까지 뽑은 횟수를 함께 보낸다). 한 명에 diamonds.hire가 든다.
  const count = Math.min(affordable(company), company.gacha.maxDraws, company.seats)
  expect(count).toBeGreaterThanOrEqual(1)
  const hire = company.diamonds.hire
  company = await companyOf(
    await api.post('/api/company/draws', { data: { count, draws: company.gacha.draws } }),
  )
  expect(company.employees).toHaveLength(count)
  expect(company.diamonds.amount).toBe(START_DIAMONDS - count * hire)

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

  // 자리 넷을 채우는 데 다이아 400개가 든다: 새 회사의 1,000개로 넉넉하다.
  expect(company.diamonds.amount).toBeGreaterThanOrEqual(company.seats * company.diamonds.hire)
  // 다이아와 한 번에 뽑는 수가 허락하는 만큼 자리를 채운다.
  while (company.employees.length < company.seats) {
    const count = Math.min(
      affordable(company),
      company.gacha.maxDraws,
      company.seats - company.employees.length,
    )
    if (count < 1) break
    const before = company.employees.length
    const diamonds = company.diamonds.amount
    company = await companyOf(
      await api.post('/api/company/draws', { data: { count, draws: company.gacha.draws } }),
    )
    expect(company.employees).toHaveLength(before + count)
    expect(company.diamonds.amount).toBe(diamonds - count * company.diamonds.hire)
  }
  expect(company.gacha.roster).toBe(company.employees.length)
  expect(company.employees.length).toBeLessThanOrEqual(company.seats)
  for (const e of company.employees) {
    expect(e.desk).not.toBeNull()
  }

  // 자리를 넘겨 뽑으면 400이다. 다이아가 모자라면 자리 때문에 거절된 것인지 가릴 수 없으므로, 넘길 만큼 다이아가 남았을 때만 확인한다.
  const over = company.seats - company.employees.length + 1
  if (affordable(company) < over || over > company.gacha.maxDraws) {
    test.info().annotations.push({
      type: 'skip-over-limit',
      description: `다이아 ${company.diamonds.amount}개로는 자리(${company.seats})를 넘겨 뽑을 수 없다`,
    })
    return
  }
  const refused = await api.post('/api/company/draws', {
    data: { count: over, draws: company.gacha.draws },
  })
  expect(refused.status()).toBe(400)
  const body = (await refused.json()) as { message?: string }
  expect(body.message ?? '').toContain('회사를 넓히면 더 뽑을 수 있어요')
  // 거절되면 직원도 다이아도 그대로다.
  const after = await companyOf(await api.get('/api/company'))
  expect(after.employees).toHaveLength(company.employees.length)
  expect(after.diamonds.amount).toBe(company.diamonds.amount)
})

test('무기 10연차는 다이아 1,000개에 열한 개를 주고, 다이아가 떨어지면 못 뽑는다 (#790)', async ({
  page,
}) => {
  const api = page.request
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  let company = await companyOf(await api.post('/api/company'))
  // 새 회사의 다이아는 10연차 한 번의 값과 꼭 같다: 직원을 뽑지 않고 바로 무기에 쓴다.
  expect(company.diamonds.amount).toBe(START_DIAMONDS)
  expect(company.diamonds.tenDraw).toBe(START_DIAMONDS)
  expect(company.diamonds.tenCount).toBe(11)

  company = await companyOf(await api.post('/api/company/weapon/draw', { data: { count: 10 } }))
  expect(company.armory?.lastDraws).toHaveLength(11)
  expect(company.diamonds.amount).toBe(0)

  // 다이아가 없으면 한 번 뽑기도 400이고, 아무것도 바뀌지 않는다.
  const refused = await api.post('/api/company/weapon/draw', { data: { count: 1 } })
  expect(refused.status()).toBe(400)
  const after = await companyOf(await api.get('/api/company'))
  expect(after.diamonds.amount).toBe(0)
})

test('출석 보상은 하루에 한 번 받는다 (#799)', async ({ page }) => {
  const api = page.request
  expect((await api.post('/api/sessions')).ok()).toBe(true)
  const opened = await companyOf(await api.post('/api/company'))
  // 새 회사는 1일 차를 받을 수 있다. 출석판은 일곱 칸이고 2·4일 차는 돈 칸이다.
  expect(opened.attendance.claimable).toBe(true)
  expect(opened.attendance.today).toBe(1)
  expect(opened.attendance.board.map((cell) => cell.diamonds)).toEqual([
    50, 0, 100, 0, 100, 100, 300,
  ])
  expect(opened.attendance.board.every((cell) => !cell.claimed)).toBe(true)

  const claimed = await companyOf(await api.post('/api/company/attendance'))
  expect(claimed.diamonds.amount).toBe(opened.diamonds.amount + 50)
  expect(claimed.attendance.claimable).toBe(false)
  expect(claimed.attendance.today).toBe(1)
  expect(claimed.attendance.board[0].claimed).toBe(true)
  expect(claimed.attendance.lastReward).toMatchObject({ day: 1, diamonds: 50 })

  // 같은 날 다시 받으면 400이고 다이아는 그대로다.
  const again = await api.post('/api/company/attendance')
  expect(again.status()).toBe(400)
  // 본 게임에서는 날짜를 넘길 수 없다.
  expect((await api.post('/api/sandbox/next-day')).status()).toBe(400)
  const after = await companyOf(await api.get('/api/company'))
  expect(after.diamonds.amount).toBe(claimed.diamonds.amount)
  expect(after.attendance.claimable).toBe(false)
})
