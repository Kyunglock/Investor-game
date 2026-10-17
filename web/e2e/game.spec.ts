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
  await page.getByRole('button', { name: '인생 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('25세 0개월')
}

/** 화면 상태에 맞춰 한 걸음 진행한다. 이벤트를 처리했으면 그 종류를 돌려준다. */
async function step(page: Page): Promise<string> {
  if (await outcomeCard(page).isVisible()) {
    await outcomeCard(page).getByRole('button', { name: '계속' }).click()
    return 'continue'
  }
  if (await eventCard(page).isVisible()) {
    const kind = (await eventCard(page).getAttribute('data-kind')) ?? ''
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
  await page.clock.runFor(2_000)
  await eventCard(page)
    .or(outcomeCard(page))
    .waitFor({ timeout: 1_500 })
    .catch(() => undefined)
  return 'time'
}

async function playUntil(page: Page, kind: string, maxSteps = 120) {
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

  await page.getByRole('button', { name: '인생 시작하기' }).click()
  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByTestId('job')).toHaveText('구직 중')
})

test('구직 기간이 지나면 직업 선택이 오고, 성향이 정해진 뒤 투자를 시작해 뉴스에 선택한다', async ({
  page,
}) => {
  await born(page)
  await expect(eventCard(page)).toBeHidden()

  await playUntil(page, 'JOB')
  await expect(page.getByTestId('outcome-message')).toContainText('일하기 시작했다')
  await step(page)
  await expect(page.getByTestId('job')).not.toHaveText('구직 중')

  await playUntil(page, 'OFFER')
  await expect(page.getByTestId('style')).not.toHaveText('아직 모름')

  await playUntil(page, 'NEWS')
  await expect(page.getByTestId('outcome-actions')).toContainText('선택 매수')
  await expect(page.getByTestId('outcome-actions')).toContainText('실제')
})

test('새로고침하면 서버의 상태에서 일시정지로 이어한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'JOB')
  await step(page)
  await page.clock.runFor(1_000)
  await page.getByRole('button', { name: '일시정지' }).click()

  const job = await page.getByTestId('job').textContent()
  const nickname = await page.getByTestId('nickname').textContent()
  await page.reload()

  await expect(page.getByTestId('job')).toHaveText(job ?? '')
  await expect(page.getByTestId('nickname')).toHaveText(nickname ?? '')
  await expect(page.getByRole('button', { name: '계속' }).or(eventCard(page))).toBeVisible()
})

test('다시 시작하면 다시 태어나 25세에서 시작한다', async ({ page }) => {
  await born(page)
  await playUntil(page, 'JOB')
  await step(page)

  await page.getByRole('button', { name: '다시 시작하기' }).click()
  await expect(page.getByTestId('birth-reveal')).toBeVisible()
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: '인생 시작하기' }).click()
  await expect(page.getByTestId('age')).toHaveText('25세 0개월')
  await expect(page.getByTestId('job')).toHaveText('구직 중')
})
