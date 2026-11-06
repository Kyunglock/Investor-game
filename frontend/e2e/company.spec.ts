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
 * 분기 넘기기를 누르면 거시경제 회의 창이 먼저 뜬다 (266·268번): 이번 분기 회사의 태도를 고르면 직원이 종목을 물어 올 수 있다 (267번). 물어 왔으면 종목
 * 회의 창으로 넘어가 고르고, 직원마다 맞대결 막대가 돌고(235번) 끝나면 창에서 그대로 분기를 넘긴다 (231번). 아무도 안 왔으면 거시경제 회의 창에서 바로
 * 넘긴다. watch면 연출을 끝까지 보고, 아니면 빨리 보기로 넘긴다. 1~3분기면 분기 실적이, 4분기면 연말 결산서가 뜨고 닫는다. 종목 회의를 했으면 true.
 */
async function passQuarter(
  page: Page,
  year: number,
  quarter: number,
  choice: string,
  watch = false,
  stance = '중립',
): Promise<boolean> {
  const label = `${year}년 차 ${quarter}분기 넘기기`
  await page.getByRole('button', { name: label, exact: true }).click()
  const macro = page.getByRole('dialog', { name: '거시경제 회의' })
  await expect(macro).toBeVisible()
  await macro.getByRole('button', { name: new RegExp(`^${stance}`) }).click()
  await expect(macro.getByTestId('macro-stance')).toHaveText(stance)
  const next = macro.getByRole('button', { name: /종목 회의 열기|분기 넘기기/ })
  await expect(next).toBeVisible()
  let held = false
  if (!(await macro.getByTestId('macro-finder').isVisible())) {
    await expect(macro.getByTestId('macro-none')).toBeVisible()
    await macro.getByRole('button', { name: `${label} →` }).click()
    await expect(macro).toBeHidden()
  } else {
    held = true
    await macro.getByRole('button', { name: '종목 회의 열기 →' }).click()
    await expect(macro).toBeHidden()
    const meeting = page.getByRole('dialog', { name: '종목 회의' })
    await expect(meeting).toBeVisible()
    // 누가 이 종목을 물어 왔는지 창 머리에 보인다 (267번).
    await expect(meeting.getByTestId('invest-finder')).toContainText('가져온 종목')
    // "산다"는 "크게 산다"(260번)와 겹치므로 이름을 그대로 맞춘다.
    await meeting.getByRole('button', { name: choice, exact: true }).click()
    await expect(meeting.getByTestId('invest-outcome')).toBeVisible()
    await expect(meeting.getByTestId('invest-choice')).toHaveText(choice)
    const settle = meeting.getByRole('button', { name: label })
    if (watch) {
      // 돈을 굴리는 직원마다 막대 하나: 맞붙을 것이 있으면 맞대결, 없으면 한쪽으로 곧장 찬다.
      const bars = meeting.locator('[data-testid="tug"], [data-testid="one-voice"]')
      await expect(bars).toHaveCount(await meeting.getByTestId('invest-result').count())
      await expect(settle).toHaveCount(0)
      await expect(settle).toBeVisible({ timeout: 15_000 })
      await expect(meeting.locator('[data-testid="tug"][data-done="false"]')).toHaveCount(0)
      // 가져온 직원을 칭찬하거나 탓하는 한 줄이 붙는다.
      await expect(meeting.getByTestId('invest-credit')).toBeVisible()
    } else {
      await meeting.getByRole('button', { name: '빨리 보기' }).click()
    }
    await settle.click()
    await expect(meeting).toBeHidden()
  }
  if (quarter < 4) {
    await closeQuarter(page, year, quarter)
  } else {
    await closeYearEnd(page, year)
    await expect(page.getByTestId('settlement')).toContainText(`${year}년 차 결산`)
  }
  return held
}

/** 한 해를 네 분기 넘긴다. 1분기는 고른 태도·결정으로, 나머지는 중립으로 지켜본다. 1분기에 종목 회의를 했으면 true. */
async function passYear(
  page: Page,
  year: number,
  choice: string,
  watch = false,
  stance = '중립',
): Promise<boolean> {
  const held = await passQuarter(page, year, 1, choice, watch, stance)
  for (let quarter = 2; quarter <= 4; quarter++) {
    await passQuarter(page, year, quarter, '지켜본다')
  }
  return held
}

/** 1~3분기를 넘기면 분기 실적이 짧게 뜬다 (268번): 자본이 얼마에서 얼마가 됐는지. 확인하면 닫힌다. */
async function closeQuarter(page: Page, year: number, quarter: number) {
  const sheet = page.getByRole('dialog', { name: '분기 실적' })
  await expect(sheet).toContainText(`${year}년 차 ${quarter}분기 실적`)
  await expect(sheet.getByTestId('quarter-change')).toBeVisible()
  // 자리마다 팀장이 보고한다 (269번). 돈을 굴리는 사람이 없으면 보고도 없다.
  const reports = await sheet.getByTestId('team-report').count()
  const staffed = await page.getByTestId('office-seat').count()
  expect(reports > 0).toBe(staffed > 0)
  await sheet.getByRole('button', { name: '확인' }).click()
  await expect(sheet).toBeHidden()
}

/**
 * 결산하면 연말 결산서가 따로 뜬다 (240번): 종목 회의 한 건과 직원들이 1년 동안 굴린 몫이 나뉘어 있고, 확인하면 닫힌다.
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
  // 업계 순위 (261번): 라이벌 증권사 여섯 가운데 꼴찌에서 시작하고 바로 위가 목표다.
  await expect(page.getByTestId('industry')).toContainText('업계 7위')
  await expect(page.getByTestId('industry')).toContainText('바로 위 한탕증권')
  // 첫 지원자는 연초 회의가 말한 "올해 필요한 인재"다.
  await expect(page.getByTestId('applicant').first()).toContainText('맞는 사람이다')
  // 지원자는 관심 섹터를 안고 온다 (233번).
  await expect(page.getByTestId('applicant-sector')).toHaveCount(3)
  await tab(page, /배치/)
  await expect(page.getByTestId('employee')).toHaveCount(0)
  await expect(page.getByTestId('desk-board')).toHaveCount(0)
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

test('공채에서 뽑아 앉히고, 자리가 차면 내보낼 사람을 고르고, 회의와 결산을 하면 세 해가 지나도 이어진다', async ({
  page,
}) => {
  test.setTimeout(240_000)
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

  // 배치 (269번): 직무 자리를 먼저 누르고 그 자리에 앉힐 직원을 고른다. 후보에는 그 자리가 원하는 능력치의 등급이 보인다.
  await tab(page, /배치/)
  await page.getByText('직원 상세 능력치').click()
  await expect(page.getByTestId('attire').first()).toContainText(/후드티|셔츠|정장/)
  const board = page.getByTestId('desk-board')
  // 섹터 데스크 (233번): 종목 섹터마다 돈을 굴리는 자리가 있다.
  await expect(board.locator('[data-desk="semiconductor"]')).toContainText('반도체 데스크')
  await expect(board.locator('[data-desk="food"]')).toContainText('식품 데스크')
  const bio = board.locator('[data-desk="bio"]')
  await expect(bio.getByTestId('desk-members')).toHaveText('비어 있음')
  await bio.getByRole('button', { name: /사람 고르기/ }).click()
  await expect(bio.getByTestId('desk-candidate')).toHaveCount(2)
  await expect(bio.getByTestId('desk-candidate').first()).toContainText('인내심')
  await bio.getByTestId('desk-candidate').first().click()
  // 앉으면 그 사람이 팀장이다.
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  await expect(bio.getByTestId('desk-members')).toContainText('(팀장)')
  const day = board.locator('[data-desk="day"]')
  await day.getByRole('button', { name: /사람 고르기/ }).click()
  await day.getByTestId('desk-candidate').filter({ hasText: '쉬는 중' }).click()
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '2')
  await expect(page.getByTestId('office-tag')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/2')
  // 같은 자리에 둘이면 팀장을 바꿀 수 있다: 단타 데스크 사람을 바이오로 옮겨 팀장으로 정한다.
  await bio.getByRole('button', { name: /사람 고르기/ }).click()
  await bio.getByTestId('desk-candidate').filter({ hasText: '단타 데스크에서 옮김' }).click()
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  await bio.getByRole('button', { name: '팀장으로' }).click()
  await expect(bio.getByRole('button', { name: '팀장으로' })).toHaveCount(1)
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  // 빼면 쉰다. 자동 배치 (232·233번): 버튼 하나로 두 사람이 다시 돈을 굴리는 자리에 앉는다.
  await bio.getByRole('button', { name: '빼기' }).first().click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('1/2')
  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/2')
  await expect(page.getByTestId('office-tag').filter({ hasText: /데스크/ })).toHaveCount(2)
  // 자리 카드에는 예상 효과가 보인다 (259번).
  await expect(bio).toContainText('맞히면 +')

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

  // 거시경제 회의 (266번): 분기 넘기기를 누르면 창이 뜬다. 큰 흐름 하나를 놓고 직원들이 한마디씩 하고, 같은 의견끼리 뭉친다(242·246번).
  // 태도는 공격·중립·방어 셋이다. 창을 닫고 배치로 돌아갈 수도 있다.
  await page.getByRole('button', { name: '1년 차 1분기 넘기기' }).click()
  const macro = page.getByRole('dialog', { name: '거시경제 회의' })
  await expect(macro.getByTestId('macro-article')).toBeVisible()
  const heads = await macro.getByTestId('macro-opinion').getByRole('heading').allInnerTexts()
  expect(heads.map((h) => Number(/(\d+)명/.exec(h)?.[1] ?? 0)).reduce((a, b) => a + b, 0)).toBe(2)
  await expect(macro.getByRole('button', { name: /판돈 ×/ })).toHaveCount(3)
  await macro.getByRole('button', { name: '배치 다시 보기' }).click()
  await expect(macro).toBeHidden()

  for (let year = 1; year <= 3; year++) {
    const held = await passYear(
      page,
      year,
      year === 1 ? '산다' : '지켜본다',
      year === 1,
      year === 1 ? '공격' : '중립',
    )
    // 첫 회사의 첫 분기에는 돈을 굴리는 직원이 꼭 종목을 물어 온다 (267번): 종목 회의를 배운다.
    if (year === 1) {
      expect(held).toBe(true)
      // 결산하면 지난 결산 탭이 열리고, 결과가 그림 속 직원 머리 위에도 뜬다.
      await expect(page.getByRole('tab', { name: /지난 결산/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      // 장부에 종목 회의 한 건이 직원들의 1년 운용과 따로 있고, 거시경제 회의의 태도가 위에 붙는다 (240·266번).
      await expect(page.getByTestId('ledger-invest')).toContainText('종목 회의')
      // 연말 결산서에 분기별 막대가 있고 1분기 태도가 보인다 (268번).
      await expect(page.getByTestId('quarter-bars').getByRole('listitem')).toHaveCount(4)
      await expect(page.getByTestId('quarter-bars').getByRole('listitem').first()).toContainText(
        '공격',
      )
      await expect(page.getByTestId('ledger-staff')).toBeVisible()
      // 그해 계약금·새로 받기 값은 인사 비용 줄로 따로 나온다 (251·262번).
      await expect(page.getByTestId('ledger-hiring')).toContainText('인사 비용')
      await expect(page.getByTestId('office-pnl')).toHaveCount(2)
    }
  }
  // 연표 탭 (263번): 차린 해부터 큰 일이 쌓이고 업적과 명예의 전당이 보인다.
  await tab(page, /연표/)
  await expect(page.getByTestId('timeline')).toContainText('1호 회사를 차렸다')
  await expect(page.getByTestId('achievement')).toHaveCount(7)
  await expect(page.getByTestId('hall').getByRole('listitem')).toHaveCount(2)
  // 매각을 뺐다(236번): 세 해가 지나도 회사는 이어지고 4년 차 공채·연초 회의가 온다. 팔 곳은 없다.
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await expect(page.getByTestId('sale')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /회사 팔기/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await tab(page, /공채/)
  await expect(page.getByTestId('applicant')).toHaveCount(3)
  await passYear(page, 4, '판다')
  await expect(page.getByText(/1호 회사 · 5년 차 1분기/)).toBeVisible()
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

test('분기 넘기기 버튼을 빠르게 두 번 눌러도 한 분기만 넘어간다 (#305)', async ({ page }) => {
  // 돈을 굴리는 직원이 없으면 회의 없이 바로 넘긴다. 예전에는 두 번째 요청이 다음 해를 결산했다.
  await openCompany(page)
  let settles = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/company/settle')) {
      settles++
    }
  })
  await page.getByRole('button', { name: '1년 차 1분기 넘기기' }).dblclick()
  await closeQuarter(page, 1, 1)
  await expect(page.getByText(/1호 회사 · 1년 차 2분기/)).toBeVisible()
  // 서버에도 같은 분기를 두 번 보내 본다: 한 분기만 넘어간다.
  const again = await page.request.post('/api/company/settle', { data: { year: 1, quarter: 1 } })
  expect(again.ok()).toBe(true)
  expect((await again.json()).quarter).toBe(2)
  await page.reload()
  await expect(page.getByText(/1호 회사 · 1년 차 2분기/)).toBeVisible()
  // 네 분기를 넘기면 연말 결산서가 뜬다. 회의를 안 했으니 결산서에 회의 줄이 없다.
  for (let quarter = 2; quarter <= 4; quarter++) {
    await page.getByRole('button', { name: `1년 차 ${quarter}분기 넘기기` }).click()
    if (quarter < 4) {
      await closeQuarter(page, 1, quarter)
    }
  }
  await expect(page.getByTestId('year-end').getByTestId('ledger-invest')).toHaveCount(0)
  await closeYearEnd(page, 1)
  await expect(page.getByText(/1호 회사 · 2년 차 1분기/)).toBeVisible()
  expect(settles).toBeGreaterThanOrEqual(1)
})

test('자동 진행을 켜면 공채·배치·회의·결산을 해마다 하고, 멈추면 선다 (245번)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openCompany(page)
  await page.getByRole('button', { name: '⟳ 자동 진행' }).click()
  await expect(page.getByTestId('auto-status')).toBeVisible()
  // 사람이 하던 결산 버튼은 자동 진행 동안 잠긴다.
  await expect(page.getByRole('button', { name: '1년 차 1분기 넘기기' })).toBeDisabled()
  // 빈 자리 둘에 사람을 뽑아 앉히고, 회의를 직원 다수결로 정하고, 결산서를 보여 준 뒤 다음 해로 간다.
  await expect(page.getByTestId('office-seat')).toHaveCount(2, { timeout: 20_000 })
  // 분기마다 분기 실적을 짧게 보여 주고, 네 분기를 넘기면 연말 결산서를 보여 준다 (268번).
  await expect(page.getByRole('dialog', { name: '분기 실적' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('dialog', { name: '연말 결산서' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/1호 회사 · 2년 차/)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '■ 자동 멈춤' }).click()
  await expect(page.getByTestId('auto-status')).toHaveCount(0)
  // 멈추면 결산서를 닫은 뒤 그 해에 머문다.
  for (const name of ['연말 결산서', '분기 실적']) {
    const sheet = page.getByRole('dialog', { name })
    if (await sheet.isVisible()) {
      await sheet.getByRole('button', { name: '확인' }).click()
    }
  }
  const year = await page.getByText(/1호 회사 · \d+년 차/).innerText()
  await page.waitForTimeout(3_000)
  await expect(page.getByText(/1호 회사 · \d+년 차/)).toHaveText(year)
})
