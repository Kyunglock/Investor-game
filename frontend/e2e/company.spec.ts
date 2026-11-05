import { expect, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 회사 한 바퀴를 확인한다 (증권사 육성 설계 4·6·9절, decisions.md 228번).
// 새 브라우저 문맥은 새 세션이라 회사가 없다: 사장의 사재로 차리고, 공채 시장에서 뽑아 앉히고, 세 해를 결산하고, 팔고 다시 차린다.

test.setTimeout(90_000)

async function openCompany(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '회사 차리기' }).click()
  await expect(page.getByTestId('company')).toBeVisible()
}

/** 계약금이 가장 싼 지원자를 뽑는다. */
async function hireCheapest(page: Page) {
  const cards = page.getByTestId('applicant')
  const fees = await cards.getByRole('button', { name: /계약금/ }).evaluateAll((buttons) =>
    buttons.map((b) => {
      const text = b.textContent ?? ''
      const eok = /(\d+)억/.exec(text)
      const man = /([\d,]+)만/.exec(text)
      return (eok ? Number(eok[1]) * 10_000 : 0) + (man ? Number(man[1].replaceAll(',', '')) : 0)
    }),
  )
  const at = fees.indexOf(Math.min(...fees))
  const before = await page.getByTestId('employee').count()
  await cards
    .nth(at)
    .getByRole('button', { name: /계약금/ })
    .click()
  await expect(page.getByTestId('employee')).toHaveCount(before + 1)
}

test('처음 오면 회사를 차리고, 직원 없이 F등급 자리 두 개와 지원자 셋이 있다', async ({ page }) => {
  await openCompany(page)
  await expect(page.getByTestId('company-grade')).toHaveText('F')
  await expect(page.getByTestId('employee')).toHaveCount(0)
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await expect(page.getByTestId('ladder').first().getByRole('listitem')).toHaveCount(15)
  // 첫 지원자는 연초 회의가 말한 "올해 필요한 인재"다.
  await expect(page.getByTestId('applicant').first()).toContainText('맞는 사람이다')

  // 회사 건물 단면: 책상은 자리 수, 아직 아무도 없다. 그림을 끄면 같은 내용을 글로 (8.1·8.4절).
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '0')
  await page.getByRole('button', { name: '그림 끄기' }).click()
  await expect(page.getByTestId('office-caption')).toHaveText(
    '사무실: 반지하 원룸, 책상 2개 · 객장: 손님 없음, 길고양이 한 마리',
  )
  await page.reload()
  await expect(page.getByTestId('office-caption')).toBeVisible()
  await page.getByRole('button', { name: '그림 켜기' }).click()
  await expect(page.getByTestId('office-art')).toBeVisible()
})

test('공채에서 뽑아 앉히고, 자리가 차면 내보낼 사람을 고르고, 투자 회의와 세 해 결산을 하면 팔고 다시 차린다', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await openCompany(page)

  await hireCheapest(page)
  await expect(page.getByTestId('applicant')).toHaveCount(2)
  await page.getByRole('button', { name: /지원자 새로 받기/ }).click()
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await hireCheapest(page)
  await expect(page.getByTestId('attire').first()).toContainText(/후드티|셔츠|정장/)

  // 자리 두 개가 찼다: 내보낼 사람을 골라야 뽑는다.
  const third = page.getByTestId('applicant').first()
  await third.getByRole('button', { name: /자리가 꽉 찼다/ }).click()
  await expect(third.getByRole('button', { name: /내보내고 뽑는다/ })).toHaveCount(2)
  await third.getByRole('button', { name: '그만둔다' }).click()

  const combos = page.getByTestId('employee').getByRole('combobox')
  await combos.nth(0).selectOption('bio')
  await combos.nth(1).selectOption('day')
  await page.getByRole('button', { name: '이렇게 앉힌다' }).click()
  await expect(page.getByRole('button', { name: '이렇게 앉힌다' })).toBeHidden()
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '2')

  // 투자 회의 (229번): 직원들이 한마디씩 하고, 돈을 굴리는 직원에게는 고집이 보인다. 정해야 결산한다.
  const invest = page.getByTestId('invest')
  await expect(invest.getByTestId('remarks').getByRole('listitem')).toHaveCount(2)
  await expect(invest.getByTestId('stubborn')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '투자 회의를 먼저 합니다' })).toBeDisabled()
  for (let year = 1; year <= 3; year++) {
    await invest.getByRole('button', { name: year === 1 ? '산다' : '지켜본다' }).click()
    await expect(invest.getByTestId('invest-outcome')).toBeVisible()
    await expect(invest.getByTestId('invest-result')).toHaveCount(2)
    await page.getByRole('button', { name: `${year}년 차 결산 보기` }).click()
    await expect(page.getByTestId('settlement')).toContainText(`${year}년 차 결산`)
    if (year === 1) {
      await expect(page.getByTestId('settlement')).toContainText('투자 회의')
    }
  }
  // 시대가 끝나면 회사를 판다. 아끼던 직원을 공동창업자로 데려가 새 시대의 F 회사를 차린다 (9절).
  await expect(page.getByTestId('sale')).toBeVisible()
  await expect(page.getByTestId('market')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('sale')).toBeVisible()
  await page.getByTestId('sale').getByRole('checkbox').first().check()
  await page.getByRole('button', { name: '회사를 팔고 새 회사를 차린다' }).click()
  await expect(page.getByText(/2호 회사 · 1년 차/)).toBeVisible()
  await expect(page.getByTestId('company-grade')).toHaveText('F')
  await expect(page.getByTestId('employee')).toHaveCount(1)
  await expect(page.getByTestId('owner')).toContainText('판 회사 1곳')
  await expect(page.getByTestId('opening')).toContainText('공동창업자')
  await expect(page.getByTestId('applicant')).toHaveCount(3)
})

test('뽑기 요청이 끊겨도 버튼이 잠기지 않고 다시 뽑을 수 있다', async ({ page }) => {
  await openCompany(page)
  let dropped = false
  await page.route('**/api/company/hires', async (route) => {
    if (!dropped) {
      dropped = true
      await route.abort('connectionreset')
      return
    }
    await route.continue()
  })
  const hire = page
    .getByTestId('applicant')
    .first()
    .getByRole('button', { name: /계약금/ })
  await hire.click()
  await expect(hire).toBeEnabled()
  await hire.click()
  await expect(page.getByTestId('employee')).toHaveCount(1)
})
