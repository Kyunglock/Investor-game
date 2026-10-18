import { expect, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 한 판의 핵심 흐름을 확인한다.
// 시계는 page.clock으로 감아서 몇 년치 시간을 몇 초 만에 보낸다. 이벤트는 판마다 랜덤이라 뜬 이벤트에 맞춰 반응한다.

const eventCard = (page: Page) => page.getByTestId('event-card')
const outcomeCard = (page: Page) => page.getByTestId('outcome-card')

/** 태어나서 능력치 공개 연출을 끝까지 보고 인생을 시작한다. */
async function born(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: '태어나기' }).click()
  await expect(page.getByTestId('birth-reveal')).toBeVisible()
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: '삶을 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('1세 0개월')
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
    await button.click()
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
  await expect(page.getByTestId('age')).toHaveText('1세 0개월')
  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByTestId('job')).toHaveText('학생')
})

test('성장기의 일상 선택으로 성향이 정해지고, 직업을 고른 뒤 투자를 시작해 뉴스에 선택한다', async ({
  page,
}) => {
  // 1세부터 투자 단계의 뉴스까지 가므로 오래 걸린다.
  test.setTimeout(120_000)
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
})

test('새로고침하면 서버의 상태에서 일시정지로 이어한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'TRAIT')
  await step(page)
  await page.clock.runFor(1_000)
  await page.getByRole('button', { name: '멈춤' }).click()

  const age = await page.getByTestId('age').textContent()
  const nickname = await page.getByTestId('nickname').textContent()
  await page.reload()

  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByTestId('age')).toHaveText(age ?? '')
  await expect(page.getByRole('button', { name: '계속' }).or(eventCard(page))).toBeVisible()
})

test('다시 시작하면 다시 태어나 1세에서 시작한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'TRAIT')
  await step(page)

  await page.getByRole('button', { name: '다시 시작' }).click()
  await expect(page.getByTestId('birth-reveal')).toBeVisible()
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: '삶을 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('1세 0개월')
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
