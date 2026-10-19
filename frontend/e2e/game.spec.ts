import { expect, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 한 판의 핵심 흐름을 확인한다.
// 시계는 page.clock으로 감아서 몇 년치 시간을 몇 초 만에 보낸다. 이벤트는 판마다 랜덤이라 뜬 이벤트에 맞춰 반응한다.

test.setTimeout(90_000)

const eventCard = (page: Page) => page.getByTestId('event-card')

/** "서버 확인: N일" 표시에서 N. */
async function reportedDay(page: Page): Promise<number> {
  const text = (await page.getByTestId('reported-day').textContent()) ?? ''
  return Number(/(\d+)일/.exec(text)?.[1] ?? -1)
}

/** "16세 3개월" → 게임 일수 (15세 0개월 = 0일). */
function dayOf(ageText: string): number {
  const m = /(\d+)세 (\d+)개월/.exec(ageText)
  return m ? (Number(m[1]) - 15) * 360 + Number(m[2]) * 30 : 0
}
const outcomeCard = (page: Page) => page.getByTestId('outcome-card')

/** 태어나서 능력치 공개 연출을 끝까지 보고 인생을 시작한다. */
async function born(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: '태어나기' }).click()
  await expect(page.getByTestId('birth-reveal')).toBeVisible()
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: '삶을 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('15세 0개월')
}

/** 화면 상태에 맞춰 한 걸음 진행한다. 이벤트를 처리했으면 그 종류를 돌려준다. */
async function step(page: Page): Promise<string> {
  if (await outcomeCard(page).isVisible()) {
    await outcomeCard(page).getByRole('button', { name: '계속' }).click()
    return 'continue'
  }
  if (await eventCard(page).isVisible()) {
    const kind = (await eventCard(page).getAttribute('data-kind')) ?? ''
    if (kind === 'TRAIT') {
      // 성장기 장면은 밸런스 게임이 아니라 선택지 3~4개의 상황극이다.
      expect(await eventCard(page).getByRole('button').count()).toBeGreaterThanOrEqual(3)
    }
    const button =
      kind === 'OFFER'
        ? eventCard(page).getByRole('button', { name: '투자를 시작한다' })
        : kind === 'NEWS'
          ? eventCard(page).getByRole('button', { name: '매수' })
          : eventCard(page).getByRole('button').first()
    const totalBefore = await page.getByTestId('total-asset').textContent()
    await button.click()
    if (kind === 'NEWS') {
      // 뉴스의 매수·매도는 수량을 묻고 확정해야 보내진다.
      await page.getByTestId('news-trade-submit').click()
    }
    if (kind === 'NEWS' || kind === 'SHAKE') {
      // 결과는 성격이 손을 움직이는 동안 잠깐 감춰져 있다. 그동안 총자산이 먼저 움직이면 결과가 샌다.
      await expect(page.getByTestId('outcome-thinking')).toBeVisible()
      await expect(page.getByTestId('total-asset')).toHaveText(totalBefore ?? '')
      await page.clock.runFor(2_500)
    }
    await expect(outcomeCard(page)).toBeVisible()
    return kind
  }
  // 시계는 다음 이벤트 시각에서 멈추므로 크게 감아도 이벤트를 건너뛰지 않는다.
  await page.clock.runFor(6_000)
  await eventCard(page)
    .or(outcomeCard(page))
    .waitFor({ timeout: 1_500 })
    .catch(() => undefined)
  return 'time'
}

async function playUntil(page: Page, kind: string, maxSteps = 150) {
  for (let i = 0; i < maxSteps; i++) {
    if ((await step(page)) === kind) {
      return
    }
  }
  throw new Error(`${kind} 이벤트를 만나지 못했다`)
}

test('처음 방문하면 태어나기를 고를 수 있다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '태어나기' })).toBeVisible()
})

test('태어나면 능력치가 안목부터 하나씩 공개되고 별명이 붙는다', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: '태어나기' }).click()

  await expect(page.getByTestId('reveal-luck')).toContainText('?')
  await page.clock.runFor(800)
  await expect(page.getByTestId('reveal-insight')).not.toContainText('?')
  await expect(page.getByTestId('reveal-luck')).toContainText('?')

  await page.clock.runFor(5_000)
  await expect(page.getByTestId('reveal-luck')).not.toContainText('?')
  const nickname = await page.getByTestId('reveal-nickname').textContent()
  expect(nickname?.trim()).toBeTruthy()

  await page.getByRole('button', { name: '삶을 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('15세 0개월')
  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByTestId('job')).toHaveText('학생')
})

test('성장기의 일상 선택으로 성향이 정해지고, 직업을 고른 뒤 투자를 시작해 뉴스에 선택한다', async ({
  page,
}) => {
  // 15세부터 투자 단계의 뉴스까지 가므로 오래 걸린다.
  test.setTimeout(240_000)
  await born(page)

  await playUntil(page, 'TRAIT')
  await expect(page.getByTestId('outcome-message')).not.toBeEmpty()
  await expect(page.getByTestId('style')).toHaveText('아직 모름')

  await playUntil(page, 'JOB')
  await expect(page.getByTestId('outcome-message')).toContainText('일하기 시작했다')
  await expect(page.getByTestId('style')).not.toHaveText('아직 모름')
  await step(page)
  await expect(page.getByTestId('job')).not.toHaveText('학생')

  await playUntil(page, 'OFFER')
  await playUntil(page, 'NEWS')
  await expect(page.getByTestId('outcome-actions')).toContainText('선택 매수')
  await expect(page.getByTestId('outcome-actions')).toContainText('실제')
  await expect(page.getByTestId('outcome-verdict')).toContainText('성격이 선택을')
})

test('새로고침하면 서버의 상태에서 일시정지로 이어한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'TRAIT')
  await step(page)
  await page.clock.runFor(1_000)
  await page.getByRole('button', { name: '멈춤' }).click()

  const age = await page.getByTestId('age').textContent()
  const nickname = await page.getByTestId('nickname').textContent()
  // 멈춤은 현재 시각을 서버에 보고한다. 보고가 끝나야 새로고침 뒤 같은 나이가 나온다.
  await expect
    .poll(async () => reportedDay(page), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(dayOf(age ?? ''))
  await page.reload()

  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByTestId('age')).toHaveText(age ?? '')
  await expect(page.getByRole('button', { name: '계속' }).or(eventCard(page))).toBeVisible()
})

test('다시 시작하면 다시 태어나 15세에서 시작한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'TRAIT')
  await step(page)

  await page.getByRole('button', { name: '다시 시작' }).click()
  await expect(page.getByTestId('birth-reveal')).toBeVisible()
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: '삶을 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('15세 0개월')
  await expect(page.getByTestId('job')).toHaveText('학생')
})

test('인생 기록은 서버에서 와서 새로고침해도 남는다', async ({ page }) => {
  await born(page)
  const birth = page.locator('[data-testid="life-log-line"][data-kind="BIRTH"]')
  const trait = page.locator('[data-testid="life-log-line"][data-kind="TRAIT"]')
  await expect(birth).toHaveCount(1)

  await playUntil(page, 'TRAIT')
  await step(page)
  await expect(trait).toHaveCount(1)
  await page.getByRole('button', { name: '멈춤' }).click()

  await page.reload()
  await expect(birth).toHaveCount(1)
  await expect(trait).toHaveCount(1)
})

test('투자를 시작하면 시장 패널에서 종목을 사고 포트폴리오에 반영된다', async ({ page }) => {
  test.setTimeout(240_000)
  await born(page)
  await playUntil(page, 'OFFER')
  await step(page)

  await page.getByTestId('open-market').click()
  await expect(page.getByTestId('market-panel')).toBeVisible()
  // 섹터 탭마다 종목 3개. 에너지는 값이 싸서 첫 월급으로도 한 주는 살 수 있다.
  await page.getByRole('button', { name: '에너지' }).click()
  await expect(page.getByTestId('stock-row')).toHaveCount(3)
  await page.getByTestId('stock-row').first().click()
  await page.getByRole('button', { name: '100%' }).click()
  await expect(page.getByTestId('trade-quantity')).not.toHaveValue('0')
  await page.getByTestId('trade-quantity').fill('1')
  await page.getByTestId('trade-submit').click()
  const result = page.getByTestId('trade-result')
  await expect(result).toBeVisible()
  const text = (await result.textContent()) ?? ''
  await page.getByRole('button', { name: '닫기' }).click()
  await expect(page.getByTestId('market-panel')).toBeHidden()
  if (!text.includes('부족')) {
    await expect(page.getByTestId('holding-row')).toHaveCount(1)
    // 든 종목이 생기면 시장 패널은 보유 탭으로 열리고, 거기서 바로 팔 수 있다 (decisions.md 34번).
    await page.getByTestId('open-market').click()
    await expect(page.getByTestId('held-tab')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('stock-row')).toHaveCount(1)
    await expect(page.getByTestId('trade-submit')).toBeVisible()
    await page.getByRole('button', { name: '닫기' }).click()
  }
  await expect(page.locator('[data-testid="life-log-line"][data-kind="TRADE"]')).toHaveCount(1)
})

test('취직하면 가계부에 생활비가 보인다', async ({ page }) => {
  test.setTimeout(240_000)
  await born(page)
  await playUntil(page, 'JOB')
  await step(page)
  // 한 달 뒤 첫 월급과 생활비가 처리되고 같은 날 투자 시작 제안이 뜬다.
  await playUntil(page, 'OFFER')
  await expect(page.getByTestId('household-card')).toContainText('생활비')
  await expect(page.getByTestId('monthly-saving')).toBeVisible()
})

test('신원 카드와 능력치는 인생 기록보다 위에 있다 (모바일 순서)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '1단 배치는 모바일에서만 본다')
  await born(page)
  const identity = await page.getByTestId('identity-card').boundingBox()
  const stats = await page.getByTestId('stat-insight').boundingBox()
  const log = await page.getByTestId('life-log').boundingBox()
  expect(identity && stats && log).toBeTruthy()
  expect(identity?.y ?? 0).toBeLessThan(log?.y ?? 0)
  expect(stats?.y ?? 0).toBeLessThan(log?.y ?? 0)
})
