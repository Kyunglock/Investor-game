import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { profileReport } from './profile'

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

describe('profileReport', () => {
  it('고른 것이 없으면 진단을 보류하고 세 축은 중간 점수', () => {
    const r = profileReport(game({ holdings: [], totalAsset: 20_000_000, yearly: [] }))
    expect(r.axes.map((a) => a.key)).toEqual(['risk', 'patience', 'diversification'])
    for (const a of r.axes) {
      expect(a.score).toBeGreaterThanOrEqual(0)
      expect(a.score).toBeLessThanOrEqual(100)
    }
    expect(r.summary).toContain('보류')
    expect(r.recommendations.length).toBeGreaterThan(0)
  })

  it('모든 수를 판정 전에 고른 행동으로 센다', () => {
    const log = [
      entry('STYLE', 24, { styleName: '장기' }),
      entry('NEWS', 30, { stockCode: 'A', chosen: 'BUY', actual: 'BUY', deviations: [] }),
      // 관망을 골랐는데 줏대 판정에 뒤집혀 샀다: 성향은 관망이고 산 종목에도 넣지 않는다.
      entry('NEWS', 31, {
        stockCode: 'B',
        chosen: 'HOLD',
        actual: 'BUY',
        deviations: [{ statCode: 'conviction' }],
      }),
      entry('PRICE', 31, { direction: 'DOWN', changeBp: 2000, pnl: -1_000_000 }),
      // 버티기를 골랐는데 인내 판정에 뒤집혀 팔았다.
      entry('SHAKE', 32, {
        stockCode: 'A',
        chosen: 'HOLD',
        actual: 'SELL',
        deviations: [{ statCode: 'patience' }],
      }),
      entry('LEVERAGE', 33, { stockCode: 'B', chosen: 'BORROW', borrowed: false }),
      entry('LEVERAGE', 35, { stockCode: 'A', chosen: 'PASS', borrowed: false }),
      entry('TRADE', 36, { stockCode: 'A', side: 'SELL', chosen: 'SELL', status: 'EXECUTED' }),
      entry('TRADE', 37, { stockCode: 'B', side: 'SELL', chosen: 'SELL', reason: 'HOUSING' }),
    ]
    const r = profileReport(game({ log }))
    const s = r.stats
    expect([s.newsCount, s.newsBuy, s.newsSell, s.newsHold]).toEqual([2, 1, 0, 1])
    expect([s.shakeCount, s.shakeHeld]).toEqual([1, 1])
    expect([s.leverageOffered, s.leverageChosen]).toEqual([2, 1])
    expect([s.tradeCount, s.tradeBuy, s.tradeSell], '집값 마련 매도는 세지 않는다').toEqual([
      1, 0, 1,
    ])
    expect(
      [s.stocksChosen, s.sectorsChosen],
      '사기로 고른 A(뉴스)와 빌리기로 고른 B(빚투)',
    ).toEqual([2, 2])
    expect(s.yearsInvesting).toBe(16)
    expect(r.axes.find((a) => a.key === 'risk')?.score, '뉴스 매수 1/2, 빚투 1/2').toBe(50)
    expect(r.summary).toContain(r.grade.name)
  })

  it('빚투 기록에 chosen이 없던 판은 빌렸는지로 센다', () => {
    const log = [
      entry('LEVERAGE', 33, { stockCode: 'A', borrowed: true }),
      entry('LEVERAGE', 35, { stockCode: 'A', borrowed: false }),
    ]
    expect(profileReport(game({ log })).stats.leverageChosen).toBe(1)
  })

  it('보유 비중·현금·수익처럼 가격이 정하는 값은 점수에 들어가지 않는다', () => {
    const log = [
      entry('NEWS', 30, { stockCode: 'A', chosen: 'BUY', actual: 'BUY', deviations: [] }),
    ]
    const rich = profileReport(game({ log, cash: 0, totalAsset: 900_000_000 }))
    const poor = profileReport(game({ log, cash: 90_000_000, totalAsset: 1_000_000, holdings: [] }))
    expect(rich.axes.map((a) => a.score)).toEqual(poor.axes.map((a) => a.score))
  })
})

describe('MBTI처럼 보는 유형', () => {
  it('네 축에서 글자 하나씩, 소신 축은 성장기 성향으로', () => {
    const log = [
      entry('STYLE', 24, { styleName: '장기' }),
      entry('NEWS', 30, { stockCode: 'A', chosen: 'BUY', actual: 'BUY', deviations: [] }),
      entry('NEWS', 31, { stockCode: 'B', chosen: 'BUY', actual: 'BUY', deviations: [] }),
      entry('SHAKE', 32, { stockCode: 'A', chosen: 'HOLD', actual: 'HOLD', deviations: [] }),
    ]
    const r = profileReport(game({ log, mindProfile: { code: 'own', name: '소신' } }))
    expect(r.poles.map((p) => p.key)).toEqual(['risk', 'patience', 'diversification', 'mind'])
    // 뉴스 2번 다 사기 → 공격(A). 흔들림 버팀·연 0.1번 매매 → 길게(L). 두 종목 두 섹터 → 40점 → 집중(F). 소신(O).
    expect(r.type.code).toBe('ALFO')
    expect(r.type.name).toBe('뚝심 있는 광부')
    expect(r.type.fits).toHaveLength(4)
    const mind = r.poles[3]
    expect([mind.letter, mind.percent, mind.score]).toEqual(['O', 100, 100])
    const risk = r.poles[0]
    expect([risk.letter, risk.percent]).toEqual(['A', 100])
  })

  it('기운 쪽의 비율을 보여 주고, 소신 축을 모르면 물음표다', () => {
    const r = profileReport(game({ log: [], mindProfile: null }))
    // 고른 것이 없으면 세 축은 50 → 왼쪽(A·L)으로 기울고, 분산은 0 → 집중(F) 100%.
    expect(r.type.code).toBe('ALF?')
    expect(r.type.name).toBe('광부')
    expect(r.poles[2]).toMatchObject({ letter: 'F', percent: 100 })
    expect(r.poles[3]).toMatchObject({ letter: '?', percent: null, score: null })
    expect(r.type.fits).toHaveLength(3)
  })
})
