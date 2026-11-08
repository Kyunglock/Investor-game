import { expect, type Locator, type Page, test } from '@playwright/test'

// 실제 브라우저·서버·DB로 회사 한 바퀴를 확인한다 (증권사 육성 설계 4·6·9절, decisions.md 228번).
// 새 브라우저 문맥은 새 세션이라 회사가 없다: 사장의 사재로 차리고, 채용권으로 뽑아 앉히고, 해마다 결산한다. 회사는 끝나지 않는다(236번).

test.setTimeout(90_000)

async function openCompany(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '바로 시작' }).click()
  await expect(page.getByTestId('company')).toBeVisible()
}

/** 회사 화면의 탭을 연다 (231번). */
async function tab(page: Page, name: RegExp) {
  await page.getByRole('tab', { name }).click()
}

/** 채용권으로 한 명씩 n명을 뽑는다 (decisions.md 312번). 채용 탭에 있어야 한다. 카드가 뒤집히는 창을 모두 열고 닫는다. */
async function drawPeople(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.getByTestId('draw-one').click()
    await closeReveal(page)
  }
}

/**
 * 뽑기 결과 창: 모두 열고 확인. 카드는 저절로도 열려서 "모두 열기"가 누르는 사이에 사라질 수 있다. 그러면 기다리지 않고 확인 버튼이 나왔는지 다시 본다.
 */
async function closeReveal(page: Page) {
  const reveal = page.getByTestId('gacha-reveal')
  await expect(reveal).toBeVisible()
  const all = reveal.getByTestId('gacha-open-all')
  const close = reveal.getByTestId('gacha-close')
  await expect(async () => {
    if (!(await close.isVisible())) {
      await all.click({ timeout: 1_000 })
    }
    await expect(close).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  await close.click()
  await expect(reveal).toHaveCount(0)
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
  const meeting = page.getByRole('dialog', { name: '종목 회의' })
  let held = false
  // 거시경제 회의는 한 해에 한 번, 1분기에만 열린다 (281번). 2~4분기에는 직원이 물어 왔으면 종목 회의가 바로 뜬다.
  if (quarter === 1) {
    await expect(macro).toBeVisible()
    await macro.getByRole('button', { name: new RegExp(`^${stance}`) }).click()
    await expect(macro.getByTestId('macro-stance')).toHaveText(stance)
    const next = macro.getByRole('button', { name: /종목 회의 열기|분기 넘기기/ })
    await expect(next).toBeVisible()
    if (!(await macro.getByTestId('macro-finder').isVisible())) {
      await expect(macro.getByTestId('macro-none')).toBeVisible()
      await macro.getByRole('button', { name: `${label} →` }).click()
      await expect(macro).toBeHidden()
    } else {
      await macro.getByRole('button', { name: '종목 회의 열기 →' }).click()
      await expect(macro).toBeHidden()
      held = true
    }
  } else {
    await expect(macro).toHaveCount(0)
    const sheet = page.getByRole('dialog', { name: quarter < 4 ? '분기 실적' : '연말 결산서' })
    await expect(meeting.or(sheet)).toBeVisible()
    held = await meeting.isVisible()
  }
  if (held) {
    await expect(meeting).toBeVisible()
    // 누가 이 종목을 물어 왔는지 창 머리에 보인다 (267번).
    await expect(meeting.getByTestId('invest-finder')).toContainText('가져온 종목')
    // 종목 분석 → 투자 결정은 한 화면씩 (368번): 분석을 보고 결정하러 간다.
    await meeting.getByTestId('invest-to-decide').click()
    const pick = quarter === 1 ? choice : '지켜본다'
    // 버튼 이름을 그대로 맞춘다.
    await meeting.getByRole('button', { name: pick, exact: true }).click()
    await declineProposal(meeting)
    await expect(meeting.getByTestId('invest-outcome')).toBeVisible()
    await expect(meeting.getByTestId('invest-choice')).toHaveText(pick)
    const settle = meeting.getByRole('button', { name: label })
    if (watch && quarter === 1) {
      // 결정 장면은 종목 차트가 그려지며 오르거나 빠지는 것이다 (283번).
      await expect(meeting.getByTestId('invest-chart')).toBeVisible()
      await expect(meeting.getByTestId('chart-change')).toHaveText(/[▲▼] [+−]\d+%/)
      await expect(settle).toHaveCount(0)
      await expect(settle).toBeVisible({ timeout: 15_000 })
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

/** 막판 뒤집기(283번)가 끼어들면 원래대로 한다: 시험이 고른 결정 그대로 간다. */
async function declineProposal(meeting: Locator) {
  // 막판 제안은 회의 창 위에 알림 창으로 뜬다 (292번): 회의 창 밖(body)에 그려진다.
  const proposal = meeting.page().getByTestId('invest-proposal')
  const outcome = meeting.getByTestId('invest-outcome')
  const decided = meeting.getByTestId('invest-decided')
  await expect(proposal.or(outcome).or(decided).first()).toBeVisible()
  // 막판 제안은 정해진 결정(도장·토론)을 보인 뒤에 뜬다 (290번).
  if (await decided.isVisible()) {
    await expect(proposal).toBeVisible({ timeout: 15_000 })
  }
  if (await proposal.isVisible()) {
    await proposal.getByRole('button', { name: '됐어, 원래대로 해' }).click()
  }
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
  await expect(sheet.getByRole('heading', { name: '연말 결산서', exact: true })).toBeVisible()
  await expect(
    sheet.getByText(`${String(year).padStart(2, '0')}년 차 · 우리 회사의 기록`, { exact: true }),
  ).toBeVisible()
  await expect(sheet.getByTestId('ledger-staff')).toContainText('직원들의 1년 운용')
  await expect(sheet.getByTestId('ledger-after')).toBeVisible()
  await sheet.getByRole('button', { name: '확인' }).click()
  await expect(sheet).toBeHidden()
  // 건물이 바뀌었으면 건물 알림이 뜬다 (281번).
  const move = page.getByTestId('move-scene')
  if (await move.isVisible()) {
    await move.getByRole('button', { name: /짐 정리 끝/ }).click()
  }
}

test('처음 오면 회사를 차리고, 직원 없이 반지하 원룸에 자리 네 개와 채용권 열 장이 있다', async ({
  page,
}) => {
  await openCompany(page)
  // 회사 등급 글자 대신 건물로 보인다 (238번): 반지하 원룸에서 시작하고 건물 사다리는 일곱 칸이다.
  await expect(page.getByTestId('company-building')).toHaveText('반지하 원룸')
  // 직원이 없으면 채용 탭이 먼저 열린다 (312번).
  await expect(page.getByRole('tab', { name: /채용/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('tickets')).toHaveText('10')
  await expect(page.getByTestId('roster')).toContainText('0명')
  await expect(page.getByTestId('collection-entry')).toHaveCount(18)
  await page.getByText('확률표').click()
  await expect(page.getByTestId('gacha-rates').getByRole('listitem')).toHaveCount(5)
  await expect(page.getByTestId('building-ladder').getByRole('listitem')).toHaveCount(7)
  await expect(page.getByTestId('next-step')).toContainText('사무실 넓히기')
  // 건물은 저절로 오르지 않는다 (296번): 이사 비용과 필요한 자본이 보이고, 자본이 모자라면 버튼이 잠긴다.
  await expect(page.getByTestId('next-step')).toContainText('이사 비용 18b')
  await expect(page.getByTestId('upgrade')).toBeDisabled()
  // 라이벌 회사를 걷어냈다 (288번): 업계 순위가 없다.
  await expect(page.getByTestId('industry')).toHaveCount(0)
  await tab(page, /배치/)
  await expect(page.getByTestId('employee')).toHaveCount(0)
  await expect(page.getByTestId('desk-board')).toHaveCount(0)
  await tab(page, /이슈/)
  await expect(page.getByTestId('meeting')).toBeVisible()

  // 회사 건물 단면: 책상은 자리 수, 아직 아무도 없다 (8.1·8.4절).
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '0')
  // 사무실 미니맵 (237번): 자리마다 칸이 있고 아직 다 빈 자리다. 누르면 쉬는 사람이 없으니 채용으로 데려간다.
  await expect(page.getByTestId('office-empty')).toHaveCount(4)
  await page.getByRole('button', { name: '빈 자리 1에 앉힐 사람 고르기' }).click()
  await expect(page.getByTestId('seat-picker')).toContainText('쉬는 직원이 없습니다')
  await page.getByTestId('seat-picker').getByRole('button', { name: '채용에서 뽑기' }).click()
  await expect(page.getByTestId('seat-picker')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /채용/ })).toHaveAttribute('aria-selected', 'true')
  // 그림 끄기는 없다(343번): 설명글은 그림 아래에 늘 있다.
  await expect(page.getByTestId('office-art')).toContainText(
    '사무실: 반지하 원룸, 책상 4개 · 객장: 손님 없음, 길고양이 한 마리',
  )
})

test('채용권으로 뽑아 앉히고, 쉬는 사람을 내보낼 수 있고, 회의와 결산을 하면 세 해가 지나도 이어진다', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await openCompany(page)

  // 뽑으면 카드가 뒤집히며 등급이 드러나고, 도감에 오른다 (312번).
  await page.getByTestId('draw-one').click()
  const reveal = page.getByTestId('gacha-reveal')
  await expect(reveal.getByTestId('gacha-card')).toHaveCount(1)
  await expect(reveal.getByTestId('gacha-card')).toHaveAttribute('data-open', 'true')
  await expect(reveal).toContainText('NEW')
  await reveal.getByTestId('gacha-close').click()
  await drawPeople(page, 3)
  await expect(page.getByTestId('tickets')).toHaveText('6')
  await expect(page.getByTestId('roster')).toContainText('4명')
  // 직원이 바뀌어 화면을 새로 그려도 채용 탭에 그대로 있다.
  await expect(page.getByRole('tab', { name: /채용/ })).toHaveAttribute('aria-selected', 'true')
  // 내보내기는 없다 (338번).
  await expect(page.getByTestId('release')).toHaveCount(0)

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
  await expect(bio.getByTestId('desk-candidate')).toHaveCount(4)
  await expect(bio.getByTestId('desk-candidate').first()).toContainText('인내심')
  await bio.getByTestId('desk-candidate').first().click()
  // 앉으면 그 사람이 팀장이다.
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  await expect(bio.getByTestId('desk-members')).toContainText(/(팀장 [A-Z]+)/)
  const day = board.locator('[data-desk="day"]')
  await day.getByRole('button', { name: /사람 고르기/ }).click()
  await day.getByTestId('desk-candidate').filter({ hasText: '쉬는 중' }).first().click()
  await expect(page.getByTestId('office-art')).toHaveAttribute('data-staff', '2')
  await expect(page.getByTestId('office-tag')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('2/4')
  // 같은 자리에 둘이면 팀장을 바꿀 수 있다: 단타 데스크 사람을 바이오로 옮겨 팀장으로 정한다.
  await bio.getByRole('button', { name: /사람 고르기/ }).click()
  await bio.getByTestId('desk-candidate').filter({ hasText: '단타 데스크에서 옮김' }).click()
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  await bio.getByRole('button', { name: '팀장으로' }).click()
  await expect(bio.getByRole('button', { name: '팀장으로' })).toHaveCount(1)
  await expect(bio.getByTestId('leader-badge')).toHaveCount(1)
  // 빼면 쉰다. 자동 배치 (232·233번): 버튼 하나로 두 사람이 다시 돈을 굴리는 자리에 앉는다.
  await bio.getByRole('button', { name: '빼기' }).first().click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('1/4')
  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('4/4')
  // 반지하(F)에는 돕는 자리가 아직 닫혀 있어(#393) 넷 다 돈을 굴리는 자리에 앉는다.
  await expect(page.getByTestId('office-tag')).toHaveCount(4)
  await expect(
    page
      .getByTestId('office-tag')
      .filter({ hasText: /데스크/ })
      .first(),
  ).toBeVisible()
  // 자리 카드에는 예상 효과가 보인다 (259번).
  await expect(bio).toContainText('맞히면 +')

  // 미니맵에서 바로 배치 (237번): 앉은 사람을 눌러 쉬게 하면 휴게실로 가고, 빈 자리를 눌러 그 사람을 골라 다시 앉힌다.
  const seats = page.getByTestId('office-seat')
  await expect(seats).toHaveCount(4)
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
  await expect(page.getByRole('tab', { name: /배치/ })).toContainText('4/4')
  await expect(page.getByTestId('office-empty')).toHaveCount(0)
  await expect(page.getByTestId('office-resting')).toHaveCount(0)

  // 거시경제 회의 (266번): 분기 넘기기를 누르면 창이 뜬다. 큰 흐름 하나를 놓고 직원들이 한마디씩 하고, 같은 의견끼리 뭉친다(242·246번).
  // 태도는 공격·중립·방어 셋이다. 창을 닫고 배치로 돌아갈 수도 있다.
  await page.getByRole('button', { name: '1년 차 1분기 넘기기' }).click()
  const macro = page.getByRole('dialog', { name: '거시경제 회의' })
  await expect(macro.getByTestId('macro-article')).toBeVisible()
  const heads = await macro.getByTestId('macro-opinion').getByRole('heading').allInnerTexts()
  expect(heads.map((h) => Number(/(\d+)명/.exec(h)?.[1] ?? 0)).reduce((a, b) => a + b, 0)).toBe(4)
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
      // 채용 뽑기는 돈이 들지 않아 첫 해에는 인사 비용 줄이 없다 (251·312번).
      await expect(page.getByTestId('ledger-hiring')).toHaveCount(0)
      // 채용권을 받은 까닭이 결산 소식에 남는다 (312번).
      await expect(page.getByTestId('settlement')).toContainText('채용권')
      // 손익은 돈을 굴리는 자리(데스크)에 앉은 사람 머리 위에만 뜬다.
      const traders = await page
        .getByTestId('office-tag')
        .filter({ hasText: /데스크/ })
        .count()
      await expect(page.getByTestId('office-pnl')).toHaveCount(traders)
    }
  }
  // 연표 탭 (263번): 차린 해부터 큰 일이 쌓이고 업적과 명예의 전당이 보인다.
  await tab(page, /연표/)
  await expect(page.getByTestId('timeline')).toContainText('1호 회사를 차렸다')
  // 업적 열다섯 (351번: 실패·재미 업적 일곱이 더해졌다).
  await expect(page.getByTestId('achievement')).toHaveCount(15)
  await expect(page.getByTestId('hall').getByRole('listitem')).toHaveCount(4)
  // 매각을 뺐다(236번): 세 해가 지나도 회사는 이어지고 4년 차 이슈가 온다. 팔 곳은 없다.
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await expect(page.getByTestId('sale')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /회사 팔기/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/1호 회사 · 4년 차/)).toBeVisible()
  await tab(page, /채용/)
  // 분기·연말마다 채용권이 쌓였다 (312번).
  await expect(page.getByTestId('tickets')).not.toHaveText('0')
  await passYear(page, 4, '판다')
  await expect(page.getByText(/1호 회사 · 5년 차 1분기/)).toBeVisible()
})

test('뽑기에서 특급이 나오면 카드가 금빛으로 떨다가 늦게 열린다 (290·312번)', async ({ page }) => {
  // 2%를 기다리기 어렵다: 뽑기 응답의 첫 카드를 특급으로 바꿔 본다.
  await page.route('**/api/company/draws', async (route) => {
    const response = await route.fetch()
    const company = await response.json()
    company.gacha.drawn[0] = { ...company.gacha.drawn[0], grade: 'B', star: true, fresh: true }
    await route.fulfill({ response, json: company })
  })
  await openCompany(page)
  await page.getByTestId('draw-one').click()
  const card = page.getByTestId('gacha-reveal').getByTestId('gacha-card').first()
  await expect(card).toHaveAttribute('data-star', 'true')
  await expect(card).toHaveAttribute('data-open', 'true', { timeout: 5_000 })
  await expect(card).toContainText('특급')
  await expect(card).toContainText('NEW')
  await page.getByTestId('gacha-close').click()
})

test('뽑기 요청이 끊겨도 버튼이 잠기지 않고 다시 뽑을 수 있다', async ({ page }) => {
  await openCompany(page)
  let dropped = false
  await page.route('**/api/company/draws', async (route) => {
    if (!dropped) {
      dropped = true
      await route.abort('connectionreset')
      return
    }
    await route.continue()
  })
  const draw = page.getByTestId('draw-one')
  await draw.click()
  await expect(draw).toBeEnabled()
  await draw.click()
  await closeReveal(page)
  await expect(page.getByTestId('roster')).toContainText('1명')
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

test('종목 회의를 열면 먼저 매수파와 매도파가 토론하며 맞붙고, 끝나면 사장이 고른다 (279·285·352번)', async ({
  page,
}) => {
  await openCompany(page)
  await drawPeople(page, 2)
  await tab(page, /배치/)
  await page.getByRole('button', { name: '자동 배치' }).click()
  await page.getByRole('button', { name: '1년 차 1분기 넘기기', exact: true }).click()
  const macro = page.getByRole('dialog', { name: '거시경제 회의' })
  await macro.getByRole('button', { name: /^중립/ }).click()
  // 첫 회사의 첫 분기에는 꼭 누가 종목을 물어 온다 (267번).
  await macro.getByRole('button', { name: '종목 회의 열기 →' }).click()
  const meeting = page.getByRole('dialog', { name: '종목 회의' })
  await expect(meeting).toBeVisible()
  // 첫 화면은 종목 분석이다 (368번): 기사와 의견만 보이고, 토론과 결정 버튼은 결정 화면에 있다.
  await expect(meeting.getByTestId('invest-article')).toBeVisible()
  await expect(meeting.getByTestId('team-clash')).toHaveCount(0)
  await expect(meeting.getByRole('button', { name: '산다', exact: true })).toHaveCount(0)
  await meeting.getByTestId('invest-to-decide').click()
  await expect(meeting.getByTestId('invest-article')).toHaveCount(0)
  // 고집 표시와 크게 산다·판다는 뺐다.
  await expect(meeting.getByTestId('stubborn')).toHaveCount(0)
  await expect(meeting.getByRole('button', { name: /크게/ })).toHaveCount(0)
  // "너희가 알아서 해"는 없다 (352번).
  await expect(meeting.getByTestId('invest-team')).toHaveCount(0)
  // 토론은 접혀 있다 (370번, #498): 결과 한 줄만 보이고, 기다리지 않고 바로 고를 수 있다.
  await expect(meeting.getByTestId('debate-summary')).toContainText(/매수 \d+ : 매도 \d+/)
  await expect(meeting.getByTestId('team-clash')).toHaveCount(0)
  await expect(meeting.getByRole('button', { name: '산다', exact: true })).toBeEnabled()
  // 펼치면 지금처럼 토론이 나오고, 끝날 때까지 결정 버튼은 잠긴다.
  await meeting.getByTestId('debate-toggle').click()
  await expect(meeting.getByRole('button', { name: '산다', exact: true })).toBeDisabled()
  const clash = meeting.getByTestId('team-clash').first()
  await expect(clash).toBeVisible()
  await expect(clash).toHaveAttribute('data-phase', 'clash')
  // 밀어내기 막대 (304번): 매수파는 왼쪽, 매도파는 오른쪽에 선다. 양쪽 다 누군가 선다. 경계에서 번개가 튄다.
  await expect(clash.getByTestId('clash-gauge')).toBeVisible()
  await expect(clash.getByTestId('side-buy').getByTestId('speaker').first()).toBeVisible()
  await expect(clash.getByTestId('side-sell').getByTestId('speaker').first()).toBeVisible()
  await expect(clash.getByTestId('clash-bolt')).toBeVisible()
  // 맞붙는 동안 매수파·매도파의 말이 한 줄씩 쭉쭉 올라온다 (285번).
  const lines = clash.getByTestId('debate-line')
  await expect(lines.first()).toHaveAttribute('data-side', 'BUY')
  await expect(lines.nth(1)).toHaveAttribute('data-side', 'SELL')
  await expect(clash).toHaveAttribute('data-phase', 'clash')
  // 말 한 줄이 글자 수만큼 머문다 (303번): 일곱 줄이면 30초 안팎.
  await expect(clash).toHaveAttribute('data-phase', 'done', { timeout: 45_000 })
  await expect(clash.getByTestId('clash-result')).toHaveText(/팀 의견: (매수|매도)!/)
  // 두 바퀴 뒤 결판 세 박자 (295·304번): 사회가 표결을 부르고, 이긴 쪽이 선언하고, 진 쪽이 물러난다.
  await expect(lines).toHaveCount(7)
  const result = await clash.getByTestId('clash-result').innerText()
  await expect(lines.nth(4)).toHaveAttribute('data-kind', 'TALLY')
  await expect(lines.nth(5)).toHaveAttribute('data-kind', 'WIN')
  await expect(lines.nth(5)).toHaveAttribute('data-side', result.includes('매수') ? 'BUY' : 'SELL')
  await expect(lines.nth(6)).toHaveAttribute('data-kind', 'LOSE')
  // 토론이 끝나면 사장 차례: 직원들이 기운 쪽이 한 줄로 보이고, 사장이 고른다.
  await expect(meeting.getByTestId('invest-your-turn')).toContainText('사장님 차례')
  await meeting
    .getByRole('button', { name: result.includes('매수') ? '산다' : '판다', exact: true })
    .click()
  await declineProposal(meeting)
  await expect(meeting.getByTestId('invest-choice')).toHaveText(
    result.includes('매수') ? '산다' : '판다',
  )
  await expect(meeting.getByTestId('invest-outcome')).toContainText('사장 결정')
  const fast = meeting.getByRole('button', { name: '빨리 보기' })
  if (await fast.isVisible()) {
    await fast.click()
  }
  await meeting.getByRole('button', { name: '1년 차 1분기 넘기기' }).click()
  await closeQuarter(page, 1, 1)
})

test('정하고 나면 누군가 막판에 반대로 하자고 하고, 따랐으면 결과를 보고 상이나 벌을 준다 (283번)', async ({
  page,
}) => {
  await openCompany(page)
  await drawPeople(page, 2)
  await tab(page, /배치/)
  await page.getByRole('button', { name: '자동 배치' }).click()
  // S 이상 직원이 없으면 제안이 오지 않는다(300번): 고른 뒤 응답에 막판 제안을 넣어 본다. 서버는 실제로 산다로 정하고(서버도 제안을 냈으면 원래대로 답한다), 따르면 상벌 차례를 붙인다.
  await page.route('**/api/company/invest', async (route) => {
    const response = await route.fetch()
    let company = await response.json()
    if (company.invest.proposal) {
      company = await (
        await page.request.post('/api/company/invest/proposal', { data: { accept: false } })
      ).json()
    }
    company.invest.outcome = null
    company.invest.ready = true
    company.invest.proposal = {
      employeeId: 1,
      name: '이도담',
      action: 'SELL',
      line: '"사장님! 잠깐만요!" 이도담이 손을 번쩍 들었다. "저… 아무래도 판다입니다."',
      choice: 'BUY',
      big: false,
      delegated: false,
      teamBuy: 0,
      teamSell: 0,
      debate: [],
    }
    await route.fulfill({ response, json: company })
  })
  let verdictLabel = ''
  await page.route('**/api/company/invest/proposal', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ accept: true })
    const company = await (await page.request.get('/api/company')).json()
    const good = company.invest.outcome.total > 0
    verdictLabel = good ? '성과금을 준다' : '이번 한 번은 봐준다'
    company.invest.verdict = {
      employeeId: 1,
      name: '이도담',
      good,
      ask: good ? '이도담의 말대로 해서 벌었다!' : '이도담의 말대로 해서 잃었다.',
      options: good
        ? [
            { code: 'BONUS', label: '성과금을 준다' },
            { code: 'RAISE', label: '연봉을 올려 준다' },
            { code: 'NOTHING', label: '"잘했다" 한마디만' },
          ]
        : [
            { code: 'CUT', label: '연봉을 깎는다' },
            { code: 'FORGIVE', label: '이번 한 번은 봐준다' },
          ],
    }
    await route.fulfill({ json: company })
  })
  await page.route('**/api/company/invest/verdict', async (route) => {
    const company = await (await page.request.get('/api/company')).json()
    company.invest.verdict = {
      employeeId: 1,
      name: '이도담',
      good: true,
      ask: '',
      options: [],
      result: '이도담: "사장님 만세!"',
    }
    await route.fulfill({ json: company })
  })
  await page.getByRole('button', { name: '1년 차 1분기 넘기기', exact: true }).click()
  const macro = page.getByRole('dialog', { name: '거시경제 회의' })
  await macro.getByRole('button', { name: /^중립/ }).click()
  await macro.getByRole('button', { name: '종목 회의 열기 →' }).click()
  const meeting = page.getByRole('dialog', { name: '종목 회의' })
  await meeting.getByTestId('invest-to-decide').click()
  await meeting.getByRole('button', { name: '산다', exact: true }).click()
  // 회의가 정해진 뒤에 막판 제안이 온다 (290번): 사장 결정 도장이 먼저 찍힌다.
  await expect(meeting.getByTestId('decided-choice')).toHaveText('산다')
  // 알림 창 (292번): "잠깐만요, 사장님!!"이 회의 창 위에 뜬다.
  const proposal = page.getByTestId('invest-proposal')
  await expect(proposal).toHaveCount(0)
  await expect(proposal).toBeVisible()
  await expect(proposal.getByTestId('proposal-shout')).toHaveText('잠깐만요, 사장님!!')
  await expect(proposal.getByTestId('proposal-line')).toContainText('잠깐만요')
  await expect(meeting.getByTestId('invest-outcome')).toHaveCount(0)
  await proposal.getByRole('button', { name: /그래, 네 말대로 해/ }).click()
  await expect(meeting.getByTestId('invest-chart')).toBeVisible()
  await meeting.getByRole('button', { name: '빨리 보기' }).click()
  const verdict = meeting.getByTestId('invest-verdict')
  await expect(verdict).toBeVisible()
  // 상벌을 고르기 전에는 넘기지 않는다.
  await expect(meeting.getByRole('button', { name: '1년 차 1분기 넘기기 →' })).toBeDisabled()
  await verdict.getByRole('button', { name: verdictLabel }).click()
  await expect(verdict.getByTestId('verdict-result')).toContainText('만세')
  await expect(meeting.getByRole('button', { name: '1년 차 1분기 넘기기 →' })).toBeEnabled()
})

test('연봉 때문에 사표를 들고 오면 붙잡을 마지막 기회가 뜬다 (282번)', async ({ page }) => {
  await openCompany(page)
  // 동결 뒤 25%를 기다리기 어렵다: 회사 응답에 사표를 넣어 본다.
  let plain: unknown = null
  await page.route('**/api/company', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const company = await response.json()
    plain = structuredClone(company)
    company.resign = {
      employeeId: 1,
      name: '이도담',
      reason: 'FROZEN',
      line: '이도담이 사표를 들고 왔다. "동결이라니요. 저 이만 가 보겠습니다."',
      before: 12_000_000,
      after: 14_520_000,
    }
    await route.fulfill({ response, json: company })
  })
  await page.route('**/api/company/resign', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ keep: true })
    await route.fulfill({ json: plain })
  })
  await page.reload()
  const resign = page.getByRole('alertdialog', { name: '사표' })
  await expect(resign).toBeVisible()
  await expect(resign.getByTestId('resign-line')).toContainText('동결이라니요')
  await expect(resign).toContainText('마지막 기회')
  await resign.getByRole('button', { name: /연봉 올려 주고 붙잡는다/ }).click()
  await expect(resign).toBeHidden()
})

test('건물이 커지면 연말 결산서 뒤 알림 창에서 옆 건물을 들이받아 무너뜨린다 (243·281·288번)', async ({
  page,
}) => {
  await openCompany(page)
  // 사재 100b로 첫해에 건물을 키우기는 어렵다: 연말 결산 응답의 등급을 올려 본다.
  await page.route('**/api/company/settle', async (route) => {
    const response = await route.fetch()
    const company = await response.json()
    if (company.quarter === 1 && company.lastSettlement) {
      company.lastSettlement.gradeBefore = 'F'
      company.lastSettlement.gradeAfter = 'E'
    }
    await route.fulfill({ response, json: company })
  })
  for (let quarter = 1; quarter <= 4; quarter++) {
    await page.getByRole('button', { name: `1년 차 ${quarter}분기 넘기기` }).click()
    if (quarter < 4) {
      await closeQuarter(page, 1, quarter)
    }
  }
  await page
    .getByRole('dialog', { name: '연말 결산서' })
    .getByRole('button', { name: '확인' })
    .click()
  const move = page.getByTestId('move-scene')
  await expect(move).toHaveAttribute('data-move', 'up')
  await expect(move.getByTestId('rival-smash')).toBeVisible()
  await expect(move).toContainText('옆 건물을 들이받아 무너뜨리고')
  // 라이벌 회사 이름은 나오지 않는다.
  await expect(move).not.toContainText('라이벌')
  await expect(page.getByRole('alertdialog', { name: '라이벌 결과' })).toHaveCount(0)
})

test('새 건물 공사가 끝나면 가림막이 걷히며 새 건물이 솟아오른다 (#347)', async ({ page }) => {
  await openCompany(page)
  // 새 건물(상가)은 한 해 걸려 짓는다: 연말 결산 응답을 완공(E → D)으로 바꿔 본다.
  await page.route('**/api/company/settle', async (route) => {
    const response = await route.fetch()
    const company = await response.json()
    if (company.quarter === 1 && company.lastSettlement) {
      company.lastSettlement.gradeBefore = 'E'
      company.lastSettlement.gradeAfter = 'D'
    }
    await route.fulfill({ response, json: company })
  })
  for (let quarter = 1; quarter <= 4; quarter++) {
    await page.getByRole('button', { name: `1년 차 ${quarter}분기 넘기기` }).click()
    if (quarter < 4) {
      await closeQuarter(page, 1, quarter)
    }
  }
  await page
    .getByRole('dialog', { name: '연말 결산서' })
    .getByRole('button', { name: '확인' })
    .click()
  const move = page.getByTestId('move-scene')
  await expect(move.getByTestId('build-complete')).toBeVisible()
  await expect(move.getByTestId('rival-smash')).toHaveCount(0)
  await expect(move).toContainText('공사가 끝났다!')
  await expect(move).toContainText('반지하 원룸 → 상가 2층')
})

test('랜드마크 타워에 오르면 결산서 뒤에 엔딩이 뜨고 다음 회사를 차리게 한다 (276번)', async ({
  page,
}) => {
  await openCompany(page)
  // 자본 100조 원은 실제로 플레이해 닿기 어렵다: 연말 결산 응답을 엔딩으로 바꿔 본다.
  await page.route('**/api/company/settle', async (route) => {
    const response = await route.fetch()
    const company = await response.json()
    if (company.quarter === 1 && company.lastSettlement) {
      company.lastSettlement.finished = true
      company.ending = { year: 1, capital: 100_000_000_000_000, grade: 'Z' }
    }
    await route.fulfill({ response, json: company })
  })
  for (let quarter = 1; quarter <= 4; quarter++) {
    await page.getByRole('button', { name: `1년 차 ${quarter}분기 넘기기` }).click()
    if (quarter < 4) {
      await closeQuarter(page, 1, quarter)
    }
  }
  const ending = page.getByRole('dialog', { name: '엔딩' })
  // 연말 결산서가 먼저다.
  await expect(ending).toHaveCount(0)
  await page
    .getByRole('dialog', { name: '연말 결산서' })
    .getByRole('button', { name: '확인' })
    .click()
  await expect(ending).toBeVisible()
  await expect(ending).toContainText('랜드마크 타워에 올랐다!')
  await expect(ending.getByTestId('ending-years')).toHaveText('반지하 원룸에서 1년 만에')
  await expect(ending.getByRole('button', { name: '사재 100b로 2호 회사 차리기' })).toBeVisible()
  // 엔딩을 본 회사는 분기를 넘기지 않는다.
  await expect(page.getByRole('button', { name: '2년 차 1분기 넘기기' })).toHaveCount(0)
})

test('자동 진행을 켜면 뽑기·배치·회의·결산을 해마다 하고, 멈추면 선다 (245번)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openCompany(page)
  await page.getByRole('button', { name: '⟳ 자동 진행' }).click()
  await expect(page.getByTestId('auto-status')).toBeVisible()
  // 사람이 하던 결산 버튼은 자동 진행 동안 잠긴다.
  await expect(page.getByRole('button', { name: '1년 차 1분기 넘기기' })).toBeDisabled()
  // 빈 자리 넷에 사람을 뽑아 앉히고(287번), 회의를 직원 다수결로 정하고, 결산서를 보여 준 뒤 다음 해로 간다.
  await expect(page.getByTestId('office-seat')).toHaveCount(4, { timeout: 30_000 })
  // 분기마다 분기 실적을 보여 주고, 네 분기를 넘기면 연말 결산서를 보여 준다 (268번).
  const quarterSheet = page.getByRole('dialog', { name: '분기 실적' })
  await expect(quarterSheet).toBeVisible({ timeout: 20_000 })
  // 창마다 20초 띄워 두고 남은 초를 창 위에 센다 (277번).
  await expect(page.getByTestId('auto-countdown')).toContainText('초 뒤 닫힘')
  await page.waitForTimeout(5_000)
  await expect(quarterSheet).toBeVisible()
  await expect(page.getByRole('dialog', { name: '연말 결산서' })).toBeVisible({ timeout: 90_000 })
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

test('개인정보처리방침이 있고, 게시자 ID가 없으면 광고 자리를 그리지 않는다 (271번)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '바로 시작' })).toBeVisible()
  await expect(page.getByTestId('ad-slot')).toHaveCount(0)
  await page.getByRole('link', { name: '개인정보처리방침' }).click()
  await expect(page.getByTestId('privacy')).toContainText('광고와 쿠키')
  await expect(page.getByTestId('privacy')).toContainText('익명 세션 쿠키')
  await page.getByRole('link', { name: /게임으로 돌아가기/ }).click()
  await expect(page.getByRole('button', { name: '바로 시작' })).toBeVisible()
})

test('튜토리얼과 함께 시작하면 걸음이 회사 상태를 따라가고, 건너뛰면 다시 보이지 않는다 (302번)', async ({
  page,
}) => {
  await page.goto('/')
  // 처음 온 사람에게는 튜토리얼 쪽이 먼저다.
  await expect(page.getByRole('button', { name: '튜토리얼과 함께 시작' })).toBeVisible()
  await page.getByRole('button', { name: '튜토리얼과 함께 시작' }).click()
  await expect(page.getByTestId('company')).toBeVisible()
  const tutorial = page.getByTestId('tutorial')
  await expect(tutorial).toContainText('튜토리얼 1/5 · 직원 뽑기')
  await expect(page.getByRole('tab', { name: /채용/ })).toHaveAttribute('aria-selected', 'true')
  // 뽑으면 걸음이 넘어가며 배치 탭으로 옮겨 간다.
  await page.getByTestId('draw-one').click()
  await closeReveal(page)
  await expect(tutorial).toContainText('2/5 · 자리에 앉히기')
  await expect(page.getByRole('tab', { name: /배치/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: '자동 배치' }).click()
  await expect(tutorial).toContainText('3/5 · 분기 넘기기')
  await tutorial.getByRole('button', { name: '건너뛰기' }).click()
  await expect(tutorial).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('company')).toBeVisible()
  await expect(tutorial).toHaveCount(0)
})
