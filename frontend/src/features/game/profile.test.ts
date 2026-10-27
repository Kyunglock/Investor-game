import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { maxDrawdownBp, profileReport } from './profile'

const stats: Stats = { insight: 42, patience: 61, courage: 19, conviction: 35, luck: 57 }
const YEAR = 360

let seq = 0
const entry = (
  kind: LogEntry['kind'],
  age: number,
  payload: Record<string, unknown>,
): LogEntry => ({
  seq: ++seq,
  day: (age - 15) * YEAR,
  kind,
  payload,
})

function game(over: Partial<Game> = {}): Game {
  return {
    gameId: 'g-1',
    status: 'ACTIVE',
    phase: 'INVESTING',
    day: (40 - 15) * YEAR,
    startAge: 15,
    endAge: 70,
    daysPerYear: YEAR,
    stats,
    initialStats: stats,
    cash: 20_000_000,
    totalAsset: 60_000_000,
    initialAsset: 10_000_000,
    invested: 30_000_000,
    debt: 0,
    holdings: [
      {
        stockCode: 'A',
        stockName: '삼송전자',
        sectorCode: 'semi',
        sectorName: '반도체',
        quantity: 10,
        avgCost: 1,
        price: 1,
        value: 30_000_000,
        pnl: 0,
        pnlBp: 0,
      },
      {
        stockCode: 'B',
        stockName: '현디차',
        sectorCode: 'auto',
        sectorName: '자동차',
        quantity: 10,
        avgCost: 1,
        price: 1,
        value: 10_000_000,
        pnl: 0,
        pnlBp: 0,
      },
    ],
    fullTimeInvestor: false,
    housing: {
      tenure: 'MONTHLY',
      deposit: 0,
      monthlyRent: 0,
      jeonseLoan: 0,
      insured: false,
      mortgageRateBp: 0,
      monthlyCost: 0,
      homes: [],
      quotes: [],
    },
    market: {
      month: 300,
      stocks: [
        {
          code: 'A',
          name: '삼송전자',
          sectorCode: 'semi',
          sectorName: '반도체',
          price: 1,
          change1mBp: 0,
          change12mBp: 0,
          spark: [],
        },
        {
          code: 'B',
          name: '현디차',
          sectorCode: 'auto',
          sectorName: '자동차',
          price: 1,
          change1mBp: 0,
          change12mBp: 0,
          spark: [],
        },
      ],
    },
    household: {
      married: false,
      children: [],
      monthlyIncome: 0,
      spouseIncome: 0,
      monthlyExpense: 0,
      retired: false,
      pension: 0,
    },
    log: [],
    yearly: [
      { age: 30, totalAsset: 20_000_000, cash: 1 },
      { age: 31, totalAsset: 40_000_000, cash: 1 },
      { age: 32, totalAsset: 24_000_000, cash: 1 },
      { age: 33, totalAsset: 50_000_000, cash: 1 },
    ],
    investorType: { code: 'long-safe-own', name: '뚝심 있는 장기 투자자', description: '' },
    ...over,
  } as Game
}

describe('maxDrawdownBp', () => {
  it('고점 대비 가장 많이 빠진 비율', () => {
    expect(maxDrawdownBp([100, 80, 120, 60, 90])).toBe(5000)
    expect(maxDrawdownBp([10, 20, 30])).toBe(0)
  })
})

describe('profileReport', () => {
  it('기록이 없으면 보류 문구와 중간 등급', () => {
    const r = profileReport(game({ holdings: [], totalAsset: 20_000_000, yearly: [] }))
    expect(r.grade.name).toBeDefined()
    expect(r.axes.map((a) => a.key)).toEqual(['risk', 'judgement', 'patience', 'diversification'])
    for (const a of r.axes) {
      expect(a.score).toBeGreaterThanOrEqual(0)
      expect(a.score).toBeLessThanOrEqual(100)
    }
    expect(r.summary).toContain('보류')
    expect(r.recommendations.length).toBeGreaterThan(0)
  })

  it('뉴스·흔들림·빚투 기록을 세고 방향 적중과 승률을 매긴다', () => {
    const log = [
      entry('STYLE', 24, { styleName: '장기' }),
      entry('NEWS', 30, {
        eventTitle: '삼송전자 신공장',
        stockCode: 'A',
        stockName: '삼송전자',
        chosen: 'BUY',
        actual: 'BUY',
        deviations: [],
        trade: { status: 'EXECUTED', amount: 10_000_000 },
      }),
      entry('PRICE', 30, {
        stockName: '삼송전자',
        direction: 'UP',
        changeBp: 1000,
        pnl: 1_000_000,
      }),
      entry('NEWS', 31, {
        eventTitle: '현디차 리콜',
        stockCode: 'B',
        stockName: '현디차',
        chosen: 'HOLD',
        actual: 'BUY',
        deviations: [{ statCode: 'conviction' }],
        trade: { status: 'EXECUTED', amount: 5_000_000 },
      }),
      entry('PRICE', 31, {
        stockName: '현디차',
        direction: 'DOWN',
        changeBp: 2000,
        pnl: -1_000_000,
      }),
      entry('SHAKE', 32, {
        eventTitle: '급락',
        stockCode: 'A',
        stockName: '삼송전자',
        chosen: 'HOLD',
        actual: 'HOLD',
        deviations: [],
        trade: {},
      }),
      entry('PRICE', 32, { stockName: '삼송전자', direction: 'UP', changeBp: 500, pnl: 500_000 }),
      entry('LEVERAGE', 33, {
        stockName: '삼송전자',
        borrowed: true,
        loan: 10_000_000,
        dropBp: 3000,
        quantity: 1,
      }),
      entry('LEVERAGE', 35, { stockName: '삼송전자', borrowed: false, dropBp: 3000 }),
      entry('TRADE', 36, {
        stockCode: 'B',
        stockName: '현디차',
        side: 'SELL',
        actual: 'SELL',
        status: 'EXECUTED',
        amount: 6_000_000,
        quantity: 5,
        realizedPnl: 1_000_000,
        deviations: [],
      }),
    ]
    const r = profileReport(game({ log }))
    const s = r.stats
    expect(s.newsCount).toBe(2)
    expect(s.newsBuy).toBe(2)
    expect(s.shakeCount).toBe(1)
    expect(s.shakeHeld).toBe(1)
    expect(s.tradeCount).toBe(1)
    expect(s.leverageOffered).toBe(2)
    expect(s.leverageTaken).toBe(1)
    expect(s.flipped).toBe(1)
    // 매수→UP 적중, 매수→DOWN 실패, 버팀→UP 적중
    expect(s.correctCalls).toBe(2)
    expect(s.wrongCalls).toBe(1)
    // 점수가 붙은 선택 4번(뉴스 2, 흔들림 1, 매매 1) 중 이익 3
    expect(s.decided).toBe(4)
    expect(s.winRateBp).toBe(7500)
    expect(s.stocksTraded).toBe(2)
    expect(s.sectorsTraded).toBe(2)
    expect(s.yearsInvesting).toBe(16)
    expect(s.maxDrawdownBp).toBe(4000)
    expect(s.concentrationBp).toBe(7500)
    expect(r.axes.find((a) => a.key === 'risk')?.evidence.join(' ')).toContain(
      '빚투 제안 2번 중 1번',
    )
    expect(r.summary).toContain(r.grade.name)
  })
})
