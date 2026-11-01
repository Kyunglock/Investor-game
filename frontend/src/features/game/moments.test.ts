import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Outcome } from '../../api/client'
import { frugalMoment, momentForNotice, momentForOutcome, recessionMoment } from './moments'

const game = (over: Partial<Game> = {}): Game =>
  ({
    day: 9000,
    totalAsset: 100_000_000,
    cash: 5_000_000,
    debt: 0,
    sex: 'F',
    household: { monthlyExpense: 2_000_000 },
    log: [],
    ...over,
  }) as unknown as Game

const outcome = (over: Partial<Outcome>): Outcome =>
  ({ kind: 'NEWS', chosen: 'BUY', actual: 'BUY', deviations: [], growth: [], ...over }) as Outcome

describe('momentForOutcome', () => {
  it('아이가 태어난 생활 선택은 기쁨', () => {
    const child: LogEntry = {
      seq: 9,
      day: 9000,
      kind: 'CHILD',
      payload: { seq: 2, cost: 1, sex: 'M' },
    }
    const m = momentForOutcome(
      outcome({ kind: 'LIFE', chosen: 'ACCEPT', actual: 'ACCEPT' }),
      game({ log: [child] }),
    )
    expect(m?.mood).toBe('joy')
    expect(m?.art.vignette).toBe('baby')
    expect(m?.caption).toContain('둘째 아들')
    expect(m?.art.figures.map((f) => [f.who, f.sex])).toEqual([['me', 'F']])
    const married = game({ log: [child], household: { married: true } as Game['household'] })
    expect(
      momentForOutcome(
        outcome({ kind: 'LIFE', chosen: 'ACCEPT', actual: 'ACCEPT' }),
        married,
      )?.art.figures.map((f) => [f.who, f.sex]),
    ).toEqual([
      ['me', 'F'],
      ['spouse', 'M'],
    ])
    expect(momentForOutcome(outcome({ kind: 'LIFE' }), game())).toBeNull()
  })

  it('아이의 나들이를 갔으면 놀이동산 그림에 아이가 선다 (decisions.md 87번)', () => {
    const went: LogEntry = {
      seq: 4,
      day: 9000,
      kind: 'LIFE',
      payload: { noticeCode: 'kid-outing', title: '놀이동산', amount: -300_000, option: 'normal' },
    }
    const withKid = game({
      log: [went],
      household: {
        children: [{ age: 7, leftHome: false, sex: 'F' }],
      } as unknown as Game['household'],
    })
    const m = momentForOutcome(outcome({ kind: 'LIFE' }), withKid)
    expect(m?.art.vignette).toBe('park')
    expect(m?.art.figures.map((f) => [f.who, f.sex])).toEqual([
      ['me', 'F'],
      ['kid', 'F'],
    ])
    expect(momentForNotice(went, withKid)?.art.vignette).toBe('park')
  })

  it('가족 여행을 갔으면 바다 그림, 안 갔으면 없다 (decisions.md 71번)', () => {
    const went: LogEntry = {
      seq: 3,
      day: 9000,
      kind: 'LIFE',
      payload: {
        noticeCode: 'family-trip',
        title: '가족 여행',
        amount: -10_000_000,
        option: 'luxury',
      },
    }
    const m = momentForOutcome(outcome({ kind: 'LIFE' }), game({ log: [went] }))
    expect(m?.art.vignette).toBe('trip')
    expect(m?.caption).toContain('호화')
    const stayed: LogEntry = {
      ...went,
      payload: { noticeCode: 'family-trip', title: '가족 여행', amount: 0, option: 'none' },
    }
    expect(momentForOutcome(outcome({ kind: 'LIFE' }), game({ log: [stayed] }))).toBeNull()
    expect(momentForNotice(stayed, game())).toBeNull()
  })

  it('총자산의 5%를 넘는 손익이면 급등은 자신감, 급락은 좌절', () => {
    const price = (pnl: number) =>
      ({
        stockName: 'A',
        direction: pnl > 0 ? 'UP' : 'DOWN',
        changeBp: 1000,
        pnl,
      }) as Outcome['price']
    expect(momentForOutcome(outcome({ price: price(6_000_000) }), game())?.mood).toBe('confident')
    expect(momentForOutcome(outcome({ price: price(-6_000_000) }), game())?.art.vignette).toBe(
      'crash',
    )
    expect(momentForOutcome(outcome({ price: price(-1_000_000) }), game())).toBeNull()
  })
})

describe('momentForNotice', () => {
  it('가족 여행 알림에만 그림이 붙는다', () => {
    const trip: LogEntry = {
      seq: 1,
      day: 1,
      kind: 'LIFE',
      payload: { noticeCode: 'family-trip', title: '가족 여행', amount: -2_500_000 },
    }
    const other: LogEntry = {
      seq: 2,
      day: 1,
      kind: 'LIFE',
      payload: { noticeCode: 'hospital', title: '병원비', amount: -1 },
    }
    expect(momentForNotice(trip, game())?.art.vignette).toBe('trip')
    expect(momentForNotice(trip, game())?.art.figures.map((f) => f.sex)).toEqual(['F', 'M'])
    expect(momentForNotice(other, game())).toBeNull()
  })
})

describe('frugalMoment', () => {
  it('현금이 한 달 생활비에 못 미치거나 빚이 있으면 긴축, 독립 전(생활비 0)은 아니다', () => {
    expect(frugalMoment(game())).toBeNull()
    expect(frugalMoment(game({ cash: 1_000_000 }))?.mood).toBe('frugal')
    expect(frugalMoment(game({ debt: 1 }))?.caption).toContain('빚')
    expect(
      frugalMoment(game({ cash: 0, household: { monthlyExpense: 0 } as Game['household'] })),
    ).toBeNull()
  })
})

describe('인생의 전환점 (decisions.md 139번)', () => {
  const today = (kind: LogEntry['kind'], payload: Record<string, unknown>): LogEntry => ({
    seq: 1,
    day: 9000,
    kind,
    payload,
  })

  it('취직·재취직은 사무실 그림과 자신감, 전업투자자는 작업실', () => {
    const first = momentForOutcome(
      outcome({ kind: 'JOB', chosen: 'office', actual: 'office' }),
      game({ log: [today('JOB', { jobTitle: '사무직', rehire: false })] }),
    )
    expect(first?.art.vignette).toBe('office')
    expect(first?.mood).toBe('confident')
    expect(first?.caption).toContain('첫 출근')
    const again = momentForOutcome(
      outcome({ kind: 'JOB', chosen: 'sales', actual: 'sales' }),
      game({ log: [today('JOB', { jobTitle: '영업직', rehire: true })] }),
    )
    expect(again?.caption).toContain('영업직으로 다시 출근')
    const investor = momentForOutcome(
      outcome({ kind: 'JOB', chosen: 'INVEST', actual: 'INVEST' }),
      game({ log: [today('JOB', { fullTimeInvestor: true })] }),
    )
    expect(investor?.art.vignette).toBe('studio')
  })

  it('구조조정으로 실직하면 빈 책상 그림과 좌절, 월급이 남은 직장 장면은 그림 없음', () => {
    const laidOff = momentForOutcome(
      outcome({ kind: 'CAREER', chosen: 'volunteer', actual: 'volunteer' }),
      game({
        log: [
          today('CAREER', {
            eventTitle: '구조조정',
            jobTitle: null,
            text: '위로금을 받았다. 월급이 끊기고 생활비는 계속 나간다.',
          }),
        ],
      }),
    )
    expect(laidOff?.art.vignette).toBe('layoff')
    expect(laidOff?.mood).toBe('despair')
    const raise = momentForOutcome(
      outcome({ kind: 'CAREER', chosen: 'hard', actual: 'hard' }),
      game({
        log: [today('CAREER', { eventTitle: '연봉 협상', jobTitle: '사무직', text: '월급 ↑' })],
      }),
    )
    expect(raise).toBeNull()
    const toInvestor = momentForOutcome(
      outcome({ kind: 'CAREER', chosen: 'invest', actual: 'invest' }),
      game({
        log: [today('CAREER', { jobTitle: null, fullTimeInvestor: true, text: '월급이 끊기고' })],
      }),
    )
    expect(toInvestor).toBeNull()
  })

  it('아이의 독립은 집 앞 그림, 결혼은 식장 그림과 기쁨. 결혼했으면 배우자도 선다', () => {
    // 35세(7200일): 어른 몸. 결혼했고 아이 둘.
    const married = game({
      day: 7200,
      startAge: 15,
      daysPerYear: 360,
      household: {
        married: true,
        children: [{ sex: 'F' }, { sex: 'M' }],
        monthlyExpense: 1,
      } as unknown as Game['household'],
    })
    const left = momentForNotice(today('CHILD_LEFT', { seq: 2, childAge: 22 }), married)
    expect(left?.art.vignette).toBe('leave-home')
    expect(left?.mood).toBeNull()
    expect(left?.art.figures.map((f) => [f.who, f.sex, f.stage])).toEqual([
      ['me', 'F', 'adult'],
      ['spouse', 'M', 'adult'],
      ['kid', 'M', 'adult'],
    ])
    expect(left?.caption).toContain('둘째')
    const wed = momentForNotice(today('CHILD_WEDDING', { seq: 1, cost: 1 }), game())
    expect(wed?.art.vignette).toBe('wedding')
    expect(wed?.mood).toBe('joy')
    expect(wed?.art.figures.map((f) => f.who)).toEqual(['me', 'kid'])
  })

  it('불황 회고는 셔터 내린 거리 그림과 좌절', () => {
    const m = recessionMoment(
      game(),
      today('CRISIS', { name: '부동산 금융 위기', severity: 'RECESSION' }),
    )
    expect(m.art.vignette).toBe('recession')
    expect(m.mood).toBe('despair')
    expect(m.caption).toContain('불황')
  })
})

describe('집들이 (decisions.md 140번)', () => {
  it('돈을 쓴 집들이는 거실 그림과 기쁨, 생략하면 그림 없음', () => {
    const housewarming: LogEntry = {
      seq: 3,
      day: 9000,
      kind: 'LIFE',
      payload: { noticeCode: 'housewarming', title: '집들이', amount: -500_000, option: 'normal' },
    }
    const g = game({
      log: [housewarming],
      household: { married: true, monthlyExpense: 1 } as unknown as Game['household'],
    })
    const m = momentForOutcome(outcome({ kind: 'LIFE', chosen: 'normal', actual: 'normal' }), g)
    expect(m?.art.vignette).toBe('family')
    expect(m?.mood).toBe('joy')
    expect(m?.art.figures.map((f) => f.who)).toEqual(['me', 'spouse'])
    expect(momentForNotice(housewarming, g)?.caption).toContain('집밥')
    const skipped: LogEntry = {
      ...housewarming,
      payload: { ...housewarming.payload, amount: 0, option: 'none' },
    }
    expect(momentForNotice(skipped, g)).toBeNull()
  })
})
