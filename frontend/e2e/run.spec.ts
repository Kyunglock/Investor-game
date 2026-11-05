import { expect, type Locator, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 3분 육성 한 판을 확인한다 (증권사 육성 설계 3·11절).
// 새 브라우저 문맥은 새 세션이라 첫 판은 늘 짜인 판이다: 쉬운 기사 → 손이 뒤집힘 → 형광펜이 틀림.

test.setTimeout(90_000)

const card = (page: Page) => page.getByTestId('run-card')
const outcome = (page: Page) => page.getByTestId('run-outcome')

async function startRun(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '수습 시작' }).click()
  await expect(card(page)).toBeVisible()
}

/** 선택지를 누르고 결과 카드(입사 심사면 결과 화면)가 뜰 때까지 기다린다. */
async function pick(page: Page, option: Locator) {
  await option.click()
  await expect(outcome(page).or(page.getByTestId('run-result'))).toBeVisible()
}

/** 결과 카드가 떠 있으면 맞대결이 끝나길 기다려 넘긴다. */
async function dismiss(page: Page) {
  if (await outcome(page).isVisible()) {
    await outcome(page).getByTestId('continue').click()
    await expect(outcome(page)).toBeHidden()
  }
}

/** 뉴스가 아닌 카드는 첫 선택지를 고르며 다음 뉴스까지 간다. */
async function nextNews(page: Page) {
  await dismiss(page)
  for (let i = 0; i < 12; i++) {
    if ((await card(page).getAttribute('data-kind')) === 'NEWS') {
      return
    }
    await pick(page, card(page).getByRole('button').first())
    await dismiss(page)
  }
  throw new Error('뉴스 카드가 오지 않았다')
}

test('처음 오면 수습을 시작하고, 능력치는 숫자 없이 등급만 보인다', async ({ page }) => {
  await startRun(page)
  await expect(page.getByTestId('run-header')).toContainText('수습 기간 1 / 12')
  await expect(page.getByTestId('grade-insight')).toHaveText(/^(F|E|D|C|B|A|S|SS|SSS)$/)
  await expect(card(page)).toHaveAttribute('data-kind', 'TRAIT')
})

test('짜인 첫 판: 사기·지켜보기만 → 손이 뒤집히고 가정 손익 → 형광펜이 열리고 → 조금/크게가 열린다', async ({
  page,
}) => {
  await startRun(page)

  await nextNews(page)
  // 첫 뉴스: 사기·지켜보기 둘만. 맞출 확률은 어디에도 없다.
  await expect(card(page).getByRole('button')).toHaveText([/산다/, /지켜본다/])
  await expect(card(page).getByText(/확률/)).toHaveCount(0)
  await expect(card(page).getByTestId('highlight')).toHaveCount(0)
  await pick(page, card(page).getByTestId('option-BUY'))
  await expect(outcome(page)).toHaveAttribute('data-flipped', 'false')

  await nextNews(page)
  // 두 번째 뉴스: 무엇을 고르든 뒤집힌다. 처음 뒤집히면 한 줄 설명과 "고른 대로 했다면"이 나온다.
  await pick(page, card(page).getByTestId('option-HOLD'))
  await expect(outcome(page)).toHaveAttribute('data-flipped', 'true')
  await expect(outcome(page).getByTestId('flip-tip')).toBeVisible()
  await expect(outcome(page).getByTestId('what-if')).toContainText('고른 대로 했다면')
  await expect(outcome(page).getByTestId('decisive')).toBeVisible()

  await nextNews(page)
  // 세 번째 뉴스: 안목이 처음 올라 형광펜이 열린다. 여백에 캐릭터의 메모.
  await expect(card(page).getByTestId('highlight')).toHaveCount(1)
  await expect(card(page).getByTestId('memo')).toBeVisible()
  await expect(card(page).getByTestId('tip').filter({ hasText: '형광펜' })).toBeVisible()
  await pick(page, card(page).getByTestId('option-HOLD'))

  await nextNews(page)
  await expect(card(page).getByTestId('option-BUY_SMALL')).toBeVisible()
  await expect(card(page).getByTestId('option-BUY_BIG')).toBeVisible()
})

/** 매 카드의 마지막 선택지(뉴스면 지켜본다)로 입사 심사 결과까지 간다. */
async function playToResult(page: Page) {
  for (let i = 0; i < 30; i++) {
    await dismiss(page)
    if (await page.getByTestId('run-result').isVisible()) {
      return
    }
    await pick(page, card(page).getByRole('button').last())
  }
  throw new Error('입사 심사에 닿지 않았다')
}

test('입사 심사의 종합 등급과 등급 사다리가 나오고, 1호 직원으로 등록하면 회사가 열린다', async ({
  page,
}) => {
  await startRun(page)
  await playToResult(page)
  await expect(page.getByTestId('overall-grade')).toHaveText(/^(F|E|D|C|B|A|S|SS|SSS)$/)
  await expect(page.getByTestId('ladder').first().getByRole('listitem')).toHaveCount(15)

  await page.reload()
  await expect(page.getByTestId('run-result')).toBeVisible()

  await page.getByRole('button', { name: '1호 직원으로 등록하고 회사를 연다' }).click()
  await expect(page.getByTestId('company')).toBeVisible()
  await expect(page.getByTestId('company-grade')).toHaveText('F')
  await expect(page.getByTestId('employee')).toHaveCount(1)
})

test('회사: 배치하고, 공채 육성으로 신입을 등록하고, 세 해를 결산하면 체험이 끝난다', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await startRun(page)
  await playToResult(page)
  await page.getByRole('button', { name: '1호 직원으로 등록하고 회사를 연다' }).click()
  await expect(page.getByTestId('meeting')).toBeVisible()

  await page.getByTestId('employee').first().getByRole('combobox').selectOption('bio')
  await page.getByRole('button', { name: '이렇게 앉힌다' }).click()
  await expect(page.getByRole('button', { name: '이렇게 앉힌다' })).toBeHidden()

  await page.getByRole('button', { name: /공채 육성/ }).click()
  await expect(card(page)).toBeVisible()
  await playToResult(page)
  await page.getByRole('button', { name: '등록한다' }).click()
  await expect(page.getByTestId('employee')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /공채 육성/ })).toBeHidden()

  for (let year = 1; year <= 3; year++) {
    await page.getByRole('button', { name: `${year}년 차 결산 보기` }).click()
    await expect(page.getByTestId('settlement')).toContainText(`${year}년 차 결산`)
  }
  await expect(page.getByRole('button', { name: /새 회사 차리기/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /새 회사 차리기/ })).toBeVisible()
})

test('새로고침하면 같은 카드에서 이어한다', async ({ page }) => {
  await startRun(page)
  await pick(page, card(page).getByRole('button').first())
  await dismiss(page)
  const title = await card(page).getByRole('heading').textContent()
  await page.reload()
  await expect(card(page).getByRole('heading')).toHaveText(title ?? '')
  await expect(page.getByTestId('run-header')).toContainText('수습 기간 2 / 12')
})

test('선택 요청이 끊겨도 선택지가 잠기지 않고 다시 고를 수 있다', async ({ page }) => {
  await startRun(page)
  let dropped = false
  await page.route('**/api/runs/*/choose', async (route) => {
    if (!dropped) {
      dropped = true
      await route.abort('connectionreset')
      return
    }
    await route.continue()
  })
  await card(page).getByRole('button').first().click()
  await expect(card(page).getByRole('button').first()).toBeEnabled()
  await card(page).getByRole('button').first().click()
  await expect(outcome(page)).toBeVisible()
})
