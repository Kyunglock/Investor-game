import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { buildCredits, scoreDecisions, stockReturns } from './credits'

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

function baseGame(over: Partial<Game> = {}): Game {
  return {
    gameId: 'g-1',
    status: 'ENDED',
    phase: 'ENDED',
    day: (70 - 15) * YEAR,
    startAge: 15,
    endAge: 70,
    daysPerYear: YEAR,
    stats,
    initialStats: stats,
    cash: 50_000_000,
    totalAsset: 80_000_000,
    initialAsset: 10_000_000,
    invested: 30_000_000,
    debt: 0,
    holdings: [],
    fullTimeInvestor: false,
    housing: {
      tenure: 'OWN',
      deposit: 0,
      monthlyRent: 0,
      jeonseLoan: 0,
      insured: false,
      mortgageRateBp: 550,
      monthlyCost: 0,
      homes: [],
      quotes: [],
    },
    market: { month: 660, stocks: [] },
    household: {
      married: false,
      children: [],
      monthlyIncome: 0,
      spouseIncome: 0,
      monthlyExpense: 2_000_000,
      retired: true,
      pension: 1_990_000,
    },
    log: [],
    yearly: [],
    result: {
      initialAsset: 10_000_000,
      finalAsset: 80_000_000,
      returnBp: 70_000,
      finalAge: 70,
      ending: 'NORMAL',
      deviationCounts: {},
    },
    ...over,
  }
}

const trade = (status: string, amount: number) => ({ status, quantity: 1, amount })

describe('scoreDecisions', () => {
  it('뉴스 선택은 충격 직후 손익이 점수고, 팔았으면 피한 손실·놓친 이익을 더한다', () => {
    const game = baseGame({
      log: [
        entry('NEWS', 30, {
          eventTitle: '반도체 호황',
          stockName: '한빛반도체',
          chosen: 'BUY',
          actual: 'BUY',
          trade: trade('EXECUTED', 1_000_000),
        }),
        entry('PRICE', 30, { direction: 'UP', changeBp: 2000, pnl: 200_000 }),
        entry('NEWS', 31, {
          eventTitle: '규제 발표',
          stockName: '한빛반도체',
          chosen: 'SELL',
          actual: 'SELL',
          trade: trade('EXECUTED', 1_200_000),
        }),
        // 내릴 뉴스 앞에서 팔았다: 남은 보유 손익 0 + 피한 손실 1,200,000 × 15% = +180,000
        entry('PRICE', 31, { direction: 'DOWN', changeBp: 1500, pnl: 0 }),
        entry('NEWS', 32, {
          eventTitle: '신제품 공개',
          stockName: '한빛반도체',
          chosen: 'HOLD',
          actual: 'SELL',
          trade: trade('EXECUTED', 2_000_000),
        }),
        // 오를 뉴스 앞에서 (인내심 부족으로) 팔았다: 놓친 이익 −2,000,000 × 10% = −200,000
        entry('PRICE', 32, { direction: 'UP', changeBp: 1000, pnl: 0 }),
        entry('NEWS', 33, {
          eventTitle: '관망',
          stockName: '한빛반도체',
          chosen: 'HOLD',
          actual: 'HOLD',
          trade: trade('HELD', 0),
        }),
        entry('PRICE', 33, { direction: 'UP', changeBp: 1000, pnl: 0 }),
      ],
    })
    const scored = scoreDecisions(game)
    expect(scored.map((d) => [d.title, d.score])).toEqual([
      ['반도체 호황', 200_000],
      ['규제 발표', 180_000],
      ['신제품 공개', -200_000],
    ])
    expect(scored[2]).toMatchObject({ chosen: 'HOLD', actual: 'SELL', age: 32, kind: 'NEWS' })
  })

  it('흔들림도 뉴스처럼 점수를 매기고 문구는 버틴다·판다로 읽는다', () => {
    const game = baseGame({
      log: [
        entry('SHAKE', 33, {
          eventTitle: '한빛반도체 급락 알림',
          stockCode: 'S1',
          stockName: '한빛반도체',
          chosen: 'HOLD',
          actual: 'SELL',
          trade: trade('EXECUTED', 3_000_000),
        }),
        // 팔고 나서 올랐다: 놓친 이익 −3,000,000 × 20% = −600,000
        entry('PRICE', 33, { direction: 'UP', changeBp: 2000, pnl: 0 }),
      ],
    })
    const scored = scoreDecisions(game)
    expect(scored).toEqual([
      {
        age: 33,
        title: '한빛반도체 급락 알림',
        stockName: '한빛반도체',
        chosen: 'HOLD',
        actual: 'SELL',
        score: -600_000,
        kind: 'SHAKE',
      },
    ])
    const credits = buildCredits(game)
    const byKey = Object.fromEntries(credits.map((s) => [s.key, s]))
    expect(byKey.worst.lines[0].sub).toBe('판다 한빛반도체 (원래는 버틴다) · -600,000원')
    expect(byKey.news.lines.map((l) => l.text)).toContain('보유 종목이 1번 흔들렸다')
  })

  it('자유 매매는 실현 손익이 점수고, 체결되지 않은 것은 뺀다', () => {
    const game = baseGame({
      log: [
        entry('TRADE', 40, {
          stockName: '해풍에너지',
          side: 'SELL',
          chosen: 'SELL',
          actual: 'SELL',
          status: 'EXECUTED',
          amount: 500_000,
          realizedPnl: -120_000,
        }),
        entry('TRADE', 41, {
          stockName: '해풍에너지',
          side: 'BUY',
          chosen: 'BUY',
          actual: 'HOLD',
          status: 'HELD',
          amount: 0,
          realizedPnl: 0,
        }),
      ],
    })
    expect(scoreDecisions(game)).toEqual([
      {
        age: 40,
        title: '해풍에너지 매도',
        stockName: '해풍에너지',
        chosen: 'SELL',
        actual: 'SELL',
        score: -120_000,
        kind: 'TRADE',
      },
    ])
  })
})

describe('stockReturns', () => {
  it('종목마다 투입과 회수(매도 + 남은 평가액)로 수익률을 내고 높은 순으로 줄 세운다', () => {
    const game = baseGame({
      log: [
        entry('NEWS', 30, {
          stockCode: 'S1',
          stockName: '한빛반도체',
          actual: 'BUY',
          trade: trade('EXECUTED', 1_000_000),
        }),
        entry('TRADE', 31, {
          stockCode: 'S1',
          stockName: '한빛반도체',
          actual: 'SELL',
          status: 'EXECUTED',
          amount: 600_000,
        }),
        entry('TRADE', 32, {
          stockCode: 'S2',
          stockName: '해풍에너지',
          actual: 'BUY',
          status: 'EXECUTED',
          amount: 2_000_000,
        }),
        entry('TRADE', 33, {
          stockCode: 'S3',
          stockName: '못산바이오',
          actual: 'BUY',
          status: 'INSUFFICIENT_CASH',
          amount: 0,
        }),
      ],
      holdings: [
        {
          stockCode: 'S1',
          stockName: '한빛반도체',
          sectorCode: 'semi',
          sectorName: '반도체',
          quantity: 1,
          avgCost: 1,
          price: 1,
          value: 700_000,
          pnl: 0,
          pnlBp: 0,
        },
      ],
    })
    expect(stockReturns(game)).toEqual([
      {
        stockCode: 'S1',
        stockName: '한빛반도체',
        invested: 1_000_000,
        recovered: 1_300_000,
        pnl: 300_000,
        pnlBp: 3000,
      },
      {
        stockCode: 'S2',
        stockName: '해풍에너지',
        invested: 2_000_000,
        recovered: 0,
        pnl: -2_000_000,
        pnlBp: -10_000,
      },
    ])
  })
})

describe('buildCredits', () => {
  it('정상 엔딩: 장 순서와 연금 문장', () => {
    const game = baseGame({
      investorType: { code: 'long-safe-own', name: '느긋한 농부', description: '길게 본다.' },
      log: [
        entry('BIRTH', 15, {}),
        entry('TRAIT', 15, { eventTitle: '용돈을 받았다', optionLabel: '저금통에 넣는다' }),
        entry('JOB', 25, { jobTitle: '회계사', monthlySalary: 3_000_000 }),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('CHILD', 31, { seq: 1, cost: 3_000_000 }),
        entry('CAREER', 35, {
          eventTitle: '연봉 협상',
          optionLabel: '강하게 요구한다',
          text: '10% 인상',
          success: true,
        }),
        entry('RETIRE', 60, { age: 60, severance: 100_000_000 }),
        entry('END', 70, {}),
      ],
      result: {
        initialAsset: 10_000_000,
        finalAsset: 80_000_000,
        returnBp: 70_000,
        finalAge: 70,
        ending: 'NORMAL',
        deviationCounts: { courage: 3 },
      },
    })
    const credits = buildCredits(game)
    expect(credits.map((s) => s.key)).toEqual([
      'title',
      'born',
      'traits',
      'work',
      'family',
      'news',
      'last',
    ])
    expect(credits[0].title).toBe('겁 많은 돌부처의 투자 인생')
    expect(credits[0].lines[1]).toEqual({ text: '70세, 은퇴 후 연금 생활', tone: 'accent' })
    expect(credits[2].lines[0]).toMatchObject({ text: '느긋한 농부', sub: '길게 본다.' })
    expect(credits[2].lines[1]).toEqual({ text: '15세 · 용돈을 받았다', sub: '저금통에 넣는다' })
    expect(credits[3].lines.map((l) => l.text)).toEqual([
      '25세, 회계사에 취직',
      '35세 · 연봉 협상',
      '60세, 은퇴',
    ])
    expect(credits[4].lines.map((l) => l.text)).toEqual([
      '29세, 결혼',
      '31세, 1번째 아이가 태어났다',
    ])
    expect(credits[5].lines[0].text).toBe('투자를 시작하지 않았다')
    expect(credits[6].lines.at(-1)).toEqual({
      text: '70세. 남은 자산 80,000,000원과 매달 연금 1,990,000원으로 여생을 보냈다.',
      tone: 'accent',
    })
  })

  it('전업투자자는 직장 장에 취직 대신 전업투자자가 된 나이를 남긴다', () => {
    const game = baseGame({
      fullTimeInvestor: true,
      log: [
        entry('BIRTH', 15, {}),
        entry('JOB', 25, {
          jobCode: 'INVEST',
          jobTitle: '전업투자자',
          monthlySalary: 0,
          rehire: false,
          fullTimeInvestor: true,
        }),
        entry('END', 70, {}),
      ],
    })
    const work = buildCredits(game).find((s) => s.key === 'work')
    expect(work?.lines).toEqual([{ text: '25세, 전업투자자가 됐다', sub: '월급 없음' }])
  })

  it('위기와 빚투가 있었으면 지나온 폭풍 장에 남는다', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('LEVERAGE', 34, { stockName: '삼송전자', borrowed: true, loan: 30_000_000 }),
        entry('CRISIS', 36, {
          name: '부동산 금융 위기',
          model: '2008년 리먼 브라더스 사태',
          severity: 'RECESSION',
          startAge: 33,
          endAge: 36,
          dropBp: 2_800,
          omens: [],
        }),
        entry('END', 70, {}),
      ],
    })
    const storms = buildCredits(game).find((s) => s.key === 'storms')
    expect(storms?.lines.map((l) => l.text)).toEqual([
      '34세, 삼송전자에 빚투',
      '33~36세, 부동산 금융 위기 (불황)',
    ])
  })

  it('파산 엔딩: 파산 문장과 뒤집힌 횟수, 가장 잘한·아쉬운 선택', () => {
    const game = baseGame({
      debt: 12_000_000,
      totalAsset: -12_000_000,
      log: [
        entry('NEWS', 30, {
          eventTitle: '호황',
          stockCode: 'S1',
          stockName: '한빛반도체',
          chosen: 'BUY',
          actual: 'BUY',
          trade: trade('EXECUTED', 1_000_000),
        }),
        entry('PRICE', 30, { direction: 'UP', changeBp: 2000, pnl: 200_000 }),
        entry('NEWS', 31, {
          eventTitle: '폭락',
          stockCode: 'S1',
          stockName: '한빛반도체',
          chosen: 'SELL',
          actual: 'HOLD',
          trade: trade('HELD', 0),
        }),
        entry('PRICE', 31, { direction: 'DOWN', changeBp: 3000, pnl: -360_000 }),
      ],
      result: {
        initialAsset: 10_000_000,
        finalAsset: -12_000_000,
        returnBp: -22_000,
        finalAge: 44,
        ending: 'BANKRUPT',
        deviationCounts: { patience: 2, courage: 5 },
      },
    })
    const credits = buildCredits(game)
    const byKey = Object.fromEntries(credits.map((s) => [s.key, s]))
    expect(byKey.title.lines[1]).toEqual({ text: '44세, 파산', tone: 'down' })
    expect(byKey.news.lines.map((l) => l.text)).toEqual([
      '뉴스 2번 앞에 섰다',
      '용기 부족으로 뒤집힌 선택 5번',
      '인내심 부족으로 뒤집힌 선택 2번',
    ])
    expect(byKey.best.lines[0]).toEqual({
      text: '30세 · 호황',
      sub: '매수 한빛반도체 · +200,000원',
      tone: 'up',
    })
    expect(byKey.worst.lines[0]).toEqual({
      text: '31세 · 폭락',
      sub: '관망 한빛반도체 (원래는 매도) · -360,000원',
      tone: 'down',
    })
    expect(byKey.stocks.lines[0].text).toBe('한빛반도체')
    expect(byKey.last.lines.at(-1)).toEqual({
      text: '44세. 빚 12,000,000원을 갚지 못해 파산했다.',
      tone: 'down',
    })
  })
})
