import { expect, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 회사 한 바퀴를 확인한다 (증권사 육성 설계 4·6·9절, decisions.md 228번).
// 새 브라우저 문맥은 새 세션이라 회사가 없다: 사장의 사재로 차리고, 공채 시장에서 뽑아 앉히고, 해마다 결산한다. 회사는 끝나지 않는다(236번).

test.setTimeout(90_000)

async function openCompany(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '회사 차리기' }).click()
  await expect(page.getByTestId('company')).toBeVisible()
}

/** 회사 화면의 탭을 연다 (231번). */
async function tab(page: Page, name: RegExp) {
  await page.getByRole('tab', { name }).click()
}

/** 계약금이 가장 싼 지원자를 뽑는다. 공채 탭에 있어야 한다. */
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
  const before = await cards.count()
  await cards
    .nth(at)
    .getByRole('button', { name: /계약금/ })
    .click()
  await expect(cards).toHaveCount(before - 1)
}

/**
 * 결산을 누르면 투자 회의 창이 뜬다. 고르면 직원마다 맞대결 막대가 돌고(235번) 끝나면 창에서 그대로 결산한다 (231번). watch면 연출을 끝까지 보고, 아니면
 * 빨리 보기로 넘긴다.
 */
async function settleYear(page: Page, year: number, choice: string, watch = false) {
  await page.getByRole('button', { name: `${year}년 차 결산 보기` }).click()
  const meeting = page.getByRole('dialog', { name: '투자 회의' })
  await expect(meeting).toBeVisible()
  await meeting.getByRole('button', { name: choice }).click()
  await expect(meeting.getByTestId('invest-outcome')).toBeVisible()
  await expect(meeting.getByTestId('invest-choice')).toHaveText(choice)
  const settle = meeting.getByRole('button', { name: `${year}년 차 결산 보기` })
  if (watch) {
    // 돈을 굴리는 직원마다 막대 하나: 맞붙을 것이 있으면 맞대결, 없으면 한쪽으로 곧장 찬다.
    const bars = meeting.locator('[data-testid="tug"], [data-testid="one-voice"]')
    await expect(bars).toHaveCount(await meeting.getByTestId('invest-result').count())
    await expect(settle).toHaveCount(0)
    await expect(settle).toBeVisible({ timeout: 15_000 })
    await expect(meeting.locator('[data-testid="tug"][data-done="false"]')).toHaveCount(0)
  } else {
    await meeting.getByRole('button', { name: '빨리 보기' }).click()
  }
  await settle.click()
  await expect(meeting).toBeHidden()
  await closeYearEnd(page, year)
  await expect(page.getByTestId('settlement')).toContainText(`${year}년 차 결산`)
}

/**
 * 결산하면 연말 결산서가 따로 뜬다 (240번): 투자 회의 한 건과 직원들이 1년 동안 굴린 몫이 나뉘어 있고, 확인하면 닫힌다.
 */
async function closeYearEnd(page: Page, year: number) {
  const sheet = page.getByRole('dialog', { name: '연말 결산서' })
  await expect(sheet).toContainText(`${year}년 차 연말 결산서`)
  await expect(sheet.getByTestId('ledger-staff')).toContainText('직원들의 1년 운용')
  await expect(sheet.getByTestId('ledger-after')).toBeVisible()
  await sheet.getByRole('button', { name: '확인' }).click()
  await expect(sheet).toBeHidden()
}

test('처음 오면 회사를 차리고, 직원 없이 반지하 원룸에 자리 두 개와 지원자 셋이 있다', async ({
  page,
}) => {
  await openCompany(page)
  // 회사 등급 글자 대신 건물로 보인다 (238번): 반지하 원룸에서 시작하고 건물 사다리는 일곱 칸이다.
  await expect(page.getByTestId('company-building')).toHaveText('반지하 원룸')
  // 직원이 없으면 공채 탭이 먼저 열린다.
  await expect(page.getByRole('tab', { name: /공채/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await expect(page.getByTestId('building-ladder').getByRole('listitem')).toHaveCount(7)
  await expect(page.getByTestId('next-step')).toContainText('사무실 넓히기')
  // 첫 지원자는 연초 회의가 말한 "올해 필요한 인재"다.
  await expect(page.getByTestId('applicant').first()).toContainText('맞는 사람이다')
  // 지원자는 관심 섹터를 안고 온다 (233번).
  await expect(page.getByTestId('applicant-sector')).toHaveCount(3)
  await tab(page, /배치/)
  await expect(page.getByTestId('employee')).toHaveCount(0)
  await tab(page, /연초 회의/)
  await expect(page.getByTestId('meeting')).toBeVisible()

  // 회사 건물 단면: 책상은 자리 수, 아직 아무도 없다. 그림을 끄면 같은 내용을 글로 (8.1·8.4절).
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '0')
  // 사무실 미니맵 (237번): 자리마다 칸이 있고 아직 다 빈 자리다. 누르면 쉬는 사람이 없으니 공채로 데려간다.
  await expect(page.getByTestId('office-empty')).toHaveCount(2)
  await page.getByRole('button', { name: '빈 자리 1에 앉힐 사람 고르기' }).click()
  await expect(page.getByTestId('seat-picker')).toContainText('쉬는 직원이 없습니다')
  await page.getByTestId('seat-picker').getByRole('button', { name: '공채에서 뽑기' }).click()
  await expect(page.getByTestId('seat-picker')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /공채/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: '그림 끄기' }).click()
  await expect(page.getByTestId('office-caption')).toHaveText(
    '사무실: 반지하 원룸, 책상 2개 · 객장: 손님 없음, 길고양이 한 마리',
  )
  await page.reload()
  await expect(page.getByTestId('office-caption')).toBeVisible()
  await page.getByRole('button', { name: '그림 켜기' }).click()
  await expect(page.getByTestId('office-art')).toBeVisible()
})

test('공채에서 뽑아 앉히고, 자리가 차면 내보낼 사람을 고르고, 투자 회의와 결산을 하면 세 해가 지나도 이어진다', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await openCompany(page)

  await hireCheapest(page)
  await page.getByRole('button', { name: /지원자 새로 받기/ }).click()
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await hireCheapest(page)
  // 직원이 바뀌어 화면을 새로 그려도 공채 탭에 그대로 있다.
  await expect(page.getByRole('tab', { name: /공채/ })).toHaveAttribute('aria-selected', 'true')

  // 자리 두 개가 찼다: 내보낼 사람을 골라야 뽑는다.
  const third = page.getByTestId('applicant').first()
  await third.getByRole('button', { name: /자리가 꽉 찼다/ }).click()
  await expect(third.getByRole('button', { name: /내보내고 뽑는다/ })).toHaveCount(2)
  await third.getByRole('button', { name: '그만둔다' }).click()

  // 자리를 누르면 바로 앉는다. 버튼에는 그 자리가 원하는 능력치의 등급이 보인다.
  await tab(page, /배치/)
  await expect(page.getByTestId('attire').first()).toContainText(/후드티|셔츠|정장/)
  const staff = page.getByTestId('employee')
  // 섹터 데스크 (233번): 종목 섹터마다 돈을 굴리는 자리가 있다.
  await expect(staff.nth(0).getByRole('button', { name: /반도체 데스크 용기/ })).toBeVisible()
  await expect(staff.nth(0).getByRole('button', { name: /식품 데스크 줏대/ })).toBeVisible()
  await staff
    .nth(0)
    .getByRole('button', { name: /바이오 데스크 인내심/ })
    .click()
  await expect(staff.nth(0).getByRole('button', { name: /바이오 데스크/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await staff
    .nth(1)
    .getByRole('button', { name: /단타 데스크 용기/ })
    .click()
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '2')
  await expect(page.getByTestId('office-tag')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/2')
  // 자동 배치 (232·233번): 한 사람을 쉬게 해도 버튼 하나로 두 사람이 다시 돈을 굴리는 자리에 앉는다.
  await staff.nth(1).getByRole('button', { name: '쉰다' }).click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('1/2')
  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/2')
  await expect(page.getByTestId('office-tag').filter({ hasText: /데스크/ })).toHaveCount(2)

  // 미니맵에서 바로 배치 (237번): 앉은 사람을 눌러 쉬게 하면 휴게실로 가고, 빈 자리를 눌러 그 사람을 골라 다시 앉힌다.
  const seats = page.getByTestId('office-seat')
  await expect(seats).toHaveCount(2)
  await seats.nth(1).click()
  const picker = page.getByTestId('seat-picker')
  await expect(picker).toContainText('어디에 앉힐까요?')
  // 누른 사람의 상세 능력치가 함께 보인다: 종합 등급과 능력치 다섯.
  await expect(picker.getByTestId('employee-detail')).toContainText('종합')
  await expect(picker.getByTestId('employee-detail').getByRole('listitem')).toHaveCount(5)
  await picker.getByRole('button', { name: '쉰다' }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByTestId('office-empty')).toHaveCount(1)
  await expect(page.getByTestId('office-resting')).toBeVisible()
  await page.getByTestId('office-empty').click()
  await expect(picker).toContainText('빈 자리에 누구를 앉힐까요?')
  await picker.getByRole('button', { name: /종합/ }).click()
  await picker.getByRole('button', { name: /단타 데스크 용기/ }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/2')
  await expect(page.getByTestId('office-empty')).toHaveCount(0)
  await expect(page.getByTestId('office-resting')).toHaveCount(0)

  // 투자 회의 (229·231번): 결산을 누르면 창이 뜬다. 직원들이 한마디씩 하고 고집이 보인다. 창을 닫고 배치로 돌아갈 수도 있다.
  await page.getByRole('button', { name: '1년 차 결산 보기' }).click()
  const meeting = page.getByRole('dialog', { name: '투자 회의' })
  await expect(meeting.getByTestId('remarks').getByRole('listitem')).toHaveCount(2)
  // 같은 의견끼리 모인다 (242번): 칸마다 몇 명인지 적혀 있고, 칸의 사람을 다 더하면 두 명이다.
  const opinions = meeting.getByTestId('opinion')
  const heads = await opinions.getByRole('heading').allInnerTexts()
  expect(heads.map((h) => Number(/(\d+)명/.exec(h)?.[1] ?? 0)).reduce((a, b) => a + b, 0)).toBe(2)
  await expect(meeting.getByTestId('stubborn')).toHaveCount(2)
  await meeting.getByRole('button', { name: '배치 다시 보기' }).click()
  await expect(meeting).toBeHidden()

  for (let year = 1; year <= 3; year++) {
    await settleYear(page, year, year === 1 ? '산다' : '지켜본다', year === 1)
    if (year === 1) {
      // 결산하면 지난 결산 탭이 열리고, 결과가 그림 속 직원 머리 위에도 뜬다.
      await expect(page.getByRole('tab', { name: /지난 결산/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      // 장부에 회의 한 건이 직원들의 1년 운용과 따로 있다 (240번).
      await expect(page.getByTestId('ledger-invest')).toContainText('투자 회의')
      await expect(page.getByTestId('ledger-staff')).toBeVisible()
      // 그해 계약금·새로 받기 값은 채용비 줄로 따로 나온다 (250번).
      await expect(page.getByTestId('ledger-hiring')).toContainText('채용비')
      await expect(page.getByTestId('office-pnl')).toHaveCount(2)
    }
  }
  // 매각을 뺐다(236번): 세 해가 지나도 회사는 이어지고 4년 차 공채·연초 회의가 온다. 팔 곳은 없다.
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await expect(page.getByTestId('sale')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /회사 팔기/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await tab(page, /공채/)
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await settleYear(page, 4, '판다')
  await expect(page.getByText(/1호 회사 · 5년 차/)).toBeVisible()
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
  await expect(page.getByTestId('applicant')).toHaveCount(2)
})

test('결산 버튼을 빠르게 두 번 눌러도 한 해만 넘어간다 (#305)', async ({ page }) => {
  // 돈을 굴리는 직원이 없으면 투자 회의 없이 바로 결산한다. 예전에는 두 번째 요청이 다음 해를 결산했다.
  await openCompany(page)
  let settles = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/company/settle')) {
      settles++
    }
  })
  await page.getByRole('button', { name: '1년 차 결산 보기' }).dblclick()
  // 회의를 안 했으니 결산서에 회의 줄이 없다.
  await expect(page.getByTestId('year-end').getByTestId('ledger-invest')).toHaveCount(0)
  await closeYearEnd(page, 1)
  await expect(page.getByTestId('settlement')).toContainText('1년 차 결산')
  await expect(page.getByText(/1호 회사 · 2년 차/)).toBeVisible()
  // 서버에도 같은 해를 두 번 보내 본다: 한 해만 넘어간다.
  const again = await page.request.post('/api/company/settle', { data: { year: 1 } })
  expect(again.ok()).toBe(true)
  expect((await again.json()).year).toBe(2)
  await page.reload()
  await expect(page.getByText(/1호 회사 · 2년 차/)).toBeVisible()
  expect(settles).toBeGreaterThanOrEqual(1)
})

test('자동 진행을 켜면 공채·배치·투자 회의·결산을 해마다 하고, 멈추면 선다 (245번)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openCompany(page)
  await page.getByRole('button', { name: '⟳ 자동 진행' }).click()
  await expect(page.getByTestId('auto-status')).toBeVisible()
  // 사람이 하던 결산 버튼은 자동 진행 동안 잠긴다.
  await expect(page.getByRole('button', { name: '1년 차 결산 보기' })).toBeDisabled()
  // 빈 자리 둘에 사람을 뽑아 앉히고, 회의를 직원 다수결로 정하고, 결산서를 보여 준 뒤 다음 해로 간다.
  await expect(page.getByTestId('office-seat')).toHaveCount(2, { timeout: 20_000 })
  await expect(page.getByRole('dialog', { name: '연말 결산서' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/1호 회사 · 3년 차/)).toBeVisible({ timeout: 40_000 })
  await page.getByRole('button', { name: '■ 자동 멈춤' }).click()
  await expect(page.getByTestId('auto-status')).toHaveCount(0)
  // 멈추면 결산서를 닫은 뒤 그 해에 머문다.
  const sheet = page.getByRole('dialog', { name: '연말 결산서' })
  if (await sheet.isVisible()) {
    await sheet.getByRole('button', { name: '확인' }).click()
  }
  const year = await page.getByText(/1호 회사 · \d+년 차/).innerText()
  await page.waitForTimeout(3_000)
  await expect(page.getByText(/1호 회사 · \d+년 차/)).toHaveText(year)
})
