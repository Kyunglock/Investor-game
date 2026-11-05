import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { buildCredits, scoreDecisions, stockReturns } from './credits'
import { yearOf } from './labels'

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
    sex: 'M',
    happiness: 72,
    family: 65,
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
      roomsName: null,
      cramped: false,
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
        seq: expect.any(Number),
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
    const lines = credits.flatMap((s) => s.lines)
    expect(lines.find((l) => l.text.startsWith('가장 아쉬운 선택'))?.sub).toBe(
      '판다 한빛반도체 (원래는 버틴다) · -600,000원',
    )
    expect(lines.map((l) => l.text)).toContain('뉴스 0번, 흔들림 1번 앞에 섰다')
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
        seq: expect.any(Number),
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

describe('buildCredits (시간순, decisions.md 70번)', () => {
  it('정상 엔딩: 제목 다음은 큰 사건만 시간순으로, 그림이 붙는 순간마다 그 해가 제목인 새 장 (decisions.md 193번)', () => {
    const game = baseGame({
      investorType: { code: 'long-safe-own', name: '느긋한 농부', description: '길게 본다.' },
      household: {
        ...baseGame().household,
        married: true,
        children: [{ age: 39, leftHome: true, sex: 'F' }],
      },
      log: [
        entry('BIRTH', 15, {}),
        entry('TRAIT', 15, { eventTitle: '용돈을 받았다', optionLabel: '저금통에 넣는다' }),
        entry('STYLE', 24, { investorTypeName: '느긋한 농부' }),
        entry('JOB', 25, { jobTitle: '회계사', monthlySalary: 3_000_000 }),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('CHILD', 31, { seq: 1, cost: 3_000_000, sex: 'F' }),
        entry('HOUSING', 33, {
          option: 'APT_JEONSE',
          label: '아파트 전세',
          price: 0,
          deposit: 300_000_000,
          regionName: '경기',
        }),
        entry('CAREER', 35, {
          eventTitle: '연봉 협상',
          optionLabel: '강하게 요구한다',
          text: '10% 인상',
          success: true,
        }),
        entry('CHILD_LEFT', 58, { seq: 1, childAge: 27, expense: 2_000_000 }),
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
    // 장: 제목 → 태어남 → 첫 일터 → 결혼 → 첫째 → 독립 → 돌아보며 → 마지막. 미리 정한 '일'·'가족' 장은 없다.
    // 아파트 전세 이사는 그림 없이 줄로만 남고(decisions.md 140번), 자녀 독립은 그림과 함께 새 장을 연다(139번).
    expect(credits.map((s) => s.key)).toEqual([
      'title',
      'born',
      'work',
      'family',
      'child-1',
      `left-${game.log[8].seq}`,
      'review',
      'last',
    ])
    expect(credits[0].title).toBe('이름 없는 투자자의 투자 인생')
    expect(credits[0].lines[1]).toEqual({ text: '70세, 은퇴 후 연금 생활', tone: 'accent' })
    // 시간순 장의 제목은 그 장이 시작된 해.
    expect(credits.slice(1, 6).map((s) => s.title)).toEqual([
      `${yearOf(15)}년`,
      `${yearOf(25)}년`,
      `${yearOf(29)}년`,
      `${yearOf(31)}년`,
      `${yearOf(58)}년`,
    ])
    // 줄은 전부 시간순이고 큰 사건만 남는다: 성장기 선택(TRAIT)·전세 이사·연봉 협상 같은 작은 일은 빠진다.
    expect(credits.slice(1, 6).flatMap((s) => s.lines.map((l) => l.text))).toEqual([
      '15세, 태어났다',
      '24세, 투자 성향이 정해졌다',
      '25세, 회계사에 취직',
      '29세, 결혼',
      '31세, 첫째 딸이 태어났다',
      '58세, 첫째가 독립했다',
      '60세, 은퇴',
    ])
    expect(credits[1].lines[0].sub).toContain('통장 10,000,000원')
    expect(credits[1].lines[1]).toEqual({
      text: '24세, 투자 성향이 정해졌다',
      sub: '느긋한 농부 — 길게 본다.',
      tone: 'accent',
    })
    expect(credits[6].lines[0].text).toBe('투자를 시작하지 않았다')
    expect(credits[7].lines.at(-1)).toEqual({
      text: '70세. 남은 자산 80,000,000원과 매달 연금 1,990,000원으로 여생을 보냈다.',
      tone: 'accent',
    })
    // 그림: 아기방 → 사무실 → 꽃 아치(손잡은 둘) → 아기 침대 → 집 앞(독립) → 창가의 노년(둘).
    expect(credits.map((s) => s.art?.vignette)).toEqual([
      undefined,
      'nursery',
      'office',
      'wedding',
      'baby',
      'leave-home',
      undefined,
      'home-old',
    ])
    // 독립 그림: 중년의 나와 배우자, 어른이 된 첫째(딸).
    expect(credits[5].art?.figures.map((f) => [f.who, f.sex, f.stage])).toEqual([
      ['me', 'M', 'middle'],
      ['spouse', 'F', 'middle'],
      ['kid', 'F', 'adult'],
    ])
    expect(credits[3].art?.figures.map((f) => [f.who, f.sex])).toEqual([
      ['me', 'M'],
      ['spouse', 'F'],
    ])
  })

  it('전업투자자는 첫 일터 그림이 시세판이고, 재취직에도 그림이 붙어 새 장이 열린다 (decisions.md 139번)', () => {
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
    expect(work?.art?.vignette).toBe('studio')

    const twoJobs = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('JOB', 25, { jobTitle: '회계사', monthlySalary: 3_000_000 }),
        entry('JOB', 40, { jobTitle: '세무사', monthlySalary: 4_000_000, rehire: true }),
        entry('END', 70, {}),
      ],
    })
    const sections = buildCredits(twoJobs)
    expect(sections.filter((s) => s.key === 'work')).toHaveLength(1)
    expect(sections.find((s) => s.key === 'work')?.lines.map((l) => l.text)).toEqual([
      '25세, 회계사에 취직',
    ])
    const again = sections.find((s) => s.key === `work-${twoJobs.log[2].seq}`)
    expect(again?.lines.map((l) => l.text)).toEqual(['40세, 세무사로 다시 취직'])
    expect(again?.art?.vignette).toBe('office')
    expect(again?.art?.figures[0].stage).toBe('middle')
  })

  it('빚투·전세사기·매도는 기록된 자리에 줄로 남고, 위기는 그림과 함께 새 장을 연다 (decisions.md 139번)', () => {
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
        entry('HOUSING', 38, { option: 'lease-end', label: '연장', fraud: true, lost: 50_000_000 }),
        entry('HOUSING', 40, { option: 'PASS', label: '넘긴다' }),
        entry('HOME_SOLD', 50, {
          regionName: '서울',
          price: 900_000_000,
          purchasePrice: 700_000_000,
        }),
        entry('END', 70, {}),
      ],
    })
    const sections = buildCredits(game)
    const born = sections.find((s) => s.key === 'born')
    expect(born?.lines.map((l) => l.text)).toEqual(['15세, 태어났다', '34세, 삼송전자에 빚투'])
    const crisis = sections.find((s) => s.key === `crisis-${game.log[2].seq}`)
    expect(crisis?.art?.vignette).toBe('recession')
    expect(crisis?.lines.map((l) => l.text)).toEqual([
      '33~36세, 부동산 금융 위기 (불황)',
      '38세, 전세사기',
      '50세, 서울 매도',
    ])
  })

  it('파산 엔딩: 가장 잘한·아쉬운 선택이 그 나이 자리에 끼어들고, 돌아보며는 뉴스·뒤집힘 한 줄과 손익이 컸던 주식 (decisions.md 193번)', () => {
    const game = baseGame({
      debt: 12_000_000,
      totalAsset: -12_000_000,
      log: [
        entry('BIRTH', 15, {}),
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
        entry('LEVERAGE', 32, { stockName: '한빛반도체', borrowed: false }),
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
    expect(byKey.born.lines).toEqual([
      expect.objectContaining({ text: '15세, 태어났다' }),
      {
        text: '가장 잘한 선택 · 30세 · 호황',
        sub: '매수 한빛반도체 · +200,000원',
        tone: 'up',
      },
      {
        text: '가장 아쉬운 선택 · 31세 · 폭락',
        sub: '관망 한빛반도체 (원래는 매도) · -360,000원',
        tone: 'down',
      },
    ])
    // 빚을 지지 않은 빚투 제안은 큰 사건이 아니라 빠진다.
    expect(byKey.review.lines.map((l) => [l.text, l.sub])).toEqual([
      ['뉴스 2번, 흔들림 0번 앞에 섰다', '성격에 뒤집힌 선택 7번'],
      ['한빛반도체', expect.stringContaining('원')],
    ])
    expect(byKey.last.lines.at(-1)).toEqual({
      text: '44세. 빚 12,000,000원을 갚지 못해 파산했다.',
      tone: 'down',
    })
    // 파산이면 마지막 그림은 비 오는 거리에 혼자.
    expect(byKey.last.art?.vignette).toBe('rain')
    expect(byKey.last.art?.figures.map((f) => f.who)).toEqual(['me'])
  })
})

describe('중간에 그만둔 판 (decisions.md 68번)', () => {
  it('제목 줄과 마지막 줄이 멈춘 나이를 말한다', () => {
    const quit = baseGame({
      result: {
        initialAsset: 10_000_000,
        finalAsset: 80_000_000,
        returnBp: 70_000,
        finalAge: 44,
        ending: 'QUIT',
        deviationCounts: {},
      },
    })
    const credits = buildCredits(quit)
    expect(credits[0].lines[1]).toEqual({ text: '44세, 여기서 멈췄다', tone: 'muted' })
    expect(credits.at(-1)?.lines.at(-1)).toEqual({
      text: '44세. 자산 80,000,000원을 들고 투자에서 손을 뗐다.',
      tone: 'muted',
    })
    expect(credits.at(-1)?.art?.vignette).toBe('home-old')
  })
})

describe('크레딧 그림 (#23)', () => {
  it('아이가 태어날 때마다 아기 침대 그림이 붙고, 배우자가 안은 아기를 내가 감싸고 바로 위 아이가 손뼉 (decisions.md 67·192·199번)', () => {
    const family = baseGame({
      household: {
        ...baseGame().household,
        married: true,
        children: [
          { age: 40, leftHome: false, sex: 'F' },
          { age: 38, leftHome: false, sex: 'M' },
          { age: 35, leftHome: false, sex: 'F' },
        ],
      },
      log: [
        entry('BIRTH', 15, {}),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('CHILD', 30, { seq: 1, cost: 0, sex: 'F' }),
        entry('CHILD', 32, { seq: 2, cost: 0, sex: 'M' }),
        entry('CHILD', 42, { seq: 3, cost: 0 }),
      ],
    })
    const credits = buildCredits(family)
    const children = credits.filter((s) => s.key.startsWith('child-'))
    // 성별은 기록에 남은 것을 쓰고, 없던 옛 기록은 '아이' (decisions.md 69번).
    expect(children.map((s) => s.lines[0].text)).toEqual([
      '30세, 첫째 딸이 태어났다',
      '32세, 둘째 아들이 태어났다',
      '42세, 셋째 아이가 태어났다',
    ])
    expect(children.map((s) => s.art?.vignette)).toEqual(['baby', 'baby', 'baby'])
    // 첫째: 부모 둘, 배우자가 아기를 안고 내가 감싼다. 둘째: 첫째가 어린이로 옆에서 손뼉. 셋째: 바로 위 둘째가 옆에.
    expect(children[0].art?.figures.map((f) => [f.who, f.pose])).toEqual([
      ['me', 'reach-right'],
      ['spouse', 'hold'],
    ])
    expect(children[0].art?.figures[1].holding).toEqual({ sex: 'F', look: 0 })
    expect(children[1].art?.figures.map((f) => [f.who, f.stage])).toEqual([
      ['kid', 'child'],
      ['me', 'adult'],
      ['spouse', 'adult'],
    ])
    // 옆에 선 첫째는 가계에 적힌 성별(딸)로 그린다.
    expect(children[1].art?.figures.map((f) => f.sex)).toEqual(['F', 'M', 'F'])
    expect(children[2].art?.figures.map((f) => [f.who, f.stage, f.look])).toEqual([
      ['kid', 'child', 1],
      ['me', 'middle', undefined],
      ['spouse', 'middle', undefined],
    ])
    // 아기 침대(40칸~)를 가리지 않고, 16칸 몸이 64칸 배경 밖으로 나가지 않는다.
    for (const s of credits) {
      for (const f of s.art?.figures ?? []) {
        expect(f.x).toBeGreaterThanOrEqual(0)
        expect(f.x + 16).toBeLessThanOrEqual(s.art?.vignette === 'baby' ? 40 : 64)
      }
    }
  })

  it('독립·결혼은 아이 장이 아니라 그 일이 있던 자리에 그림과 함께 새 장으로 (decisions.md 68·70·139번)', () => {
    const grown = buildCredits(
      baseGame({
        household: {
          ...baseGame().household,
          married: true,
          children: [{ age: 30, leftHome: true, sex: 'M' }],
        },
        log: [
          entry('BIRTH', 15, {}),
          entry('MARRIAGE', 29, { cost: 30_000_000 }),
          entry('CHILD', 30, { seq: 1, cost: 0, sex: 'M' }),
          entry('CHILD_LEFT', 57, { seq: 1, childAge: 27, expense: 2_000_000 }),
          entry('CHILD_WEDDING', 60, {
            seq: 1,
            total: 60_000_000,
            cost: 30_000_000,
            shareBp: 5000,
          }),
        ],
      }),
    )
    const first = grown.find((s) => s.key === 'child-1')
    expect(first?.lines.map((l) => l.text)).toEqual(['30세, 첫째 아들이 태어났다'])
    const left = grown.find((s) => s.key?.startsWith('left-'))
    expect(left?.lines[0]).toMatchObject({
      text: '57세, 첫째가 독립했다',
      sub: '27살에 집을 나갔다',
    })
    expect(left?.art?.vignette).toBe('leave-home')
    expect(left?.art?.figures.map((f) => f.who)).toEqual(['me', 'spouse', 'kid'])
    const wed = grown.find((s) => s.key?.startsWith('wedding-'))
    expect(wed?.lines[0]).toMatchObject({
      text: '60세, 첫째가 결혼했다',
      sub: '결혼 비용 60,000,000원 가운데 30,000,000원을 보탰다',
    })
    expect(wed?.art?.vignette).toBe('wedding')
  })

  it('아파트를 산 것(청약 당첨)에만 집 그림이 붙고, 월세·빌라 이사는 크레딧에 남지 않는다 (decisions.md 140·193번)', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('HOUSING', 26, {
          option: 'MONTHLY',
          label: '월세 원룸',
          price: 0,
          deposit: 5_000_000,
        }),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('HOUSING', 30, { option: 'VILLA_INSURED', label: '빌라 전세', price: 0, deposit: 1 }),
        entry('HOUSING', 36, {
          option: 'APPLY',
          label: '청약',
          price: 700_000_000,
          regionName: '서울',
          won: true,
          bought: true,
        }),
        entry('HOUSING', 40, { option: 'APPLY', label: '청약', won: false, bought: false }),
      ],
    })
    const sections = buildCredits(game)
    const homes = sections.filter((s) => s.key.startsWith('home-'))
    // 내가 살 집을 산 날은 새집 앞에서 손뼉 (decisions.md 192번).
    expect(homes.map((s) => s.art?.vignette)).toEqual(['new-home'])
    // 새집을 올려다보는 뒷모습 (decisions.md 196번).
    expect(homes[0].art?.figures.map((f) => f.view)).toEqual(['back', 'back'])
    expect(homes.map((s) => s.art?.figures.length)).toEqual([2])
    expect(homes[0].lines[0]).toEqual({
      text: '36세, 청약 당첨 · 서울',
      sub: '분양가 700,000,000원',
      tone: 'up',
    })
    const texts = sections.flatMap((s) => s.lines.map((l) => l.text))
    expect(texts).not.toContain('26세, 월세 원룸')
    expect(texts).not.toContain('30세, 빌라 전세')
  })

  it('배우자의 월세 불만은 크레딧에 남지 않고, 그 말에 집을 샀으면 부제가 붙는다 (#116, decisions.md 193번)', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('HOUSING', 30, { definition: 'spouse-rent:1:0:은행원', option: 'WAIT', price: 0 }),
        entry('HOUSING', 32, { definition: 'spouse-rent:2:1:은행원', option: 'STAY', price: 0 }),
        entry('HOUSING', 33, {
          definition: 'spouse-rent:3:1:은행원',
          option: 'APT_JEONSE',
          label: '경기 아파트 전세 (전세대출)',
          price: 0,
          deposit: 300_000_000,
        }),
        entry('HOUSING', 36, {
          definition: 'spouse-rent:4:1:은행원',
          option: 'BUY_GYEONGGI',
          price: 500_000_000,
          regionName: '경기',
        }),
      ],
    })
    const sections = buildCredits(game)
    const lines = sections.flatMap((s) => s.lines)
    expect(lines.filter((l) => /^3[023]세/.test(l.text))).toEqual([])
    expect(lines.find((l) => l.text === '36세, 경기 매수')).toEqual({
      text: '36세, 경기 매수',
      sub: '아내의 말에 월세를 벗어났다 · 500,000,000원',
    })
    expect(sections.filter((s) => s.key.startsWith('home-'))).toHaveLength(1)
  })

  it('집이 좁아 산 집에는 누가 태어나 옮겼는지 적는다. 좁아도 그냥 산 것과 세집 이사는 남지 않는다 (#117)', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('HOUSING', 26, {
          option: 'MONTHLY',
          label: '월세로 산다',
          roomsName: '원룸',
          price: 0,
          deposit: 10_000_000,
        }),
        entry('HOUSING', 30, { definition: 'cramped:marriage', option: 'ENDURE', price: 0 }),
        entry('HOUSING', 33, {
          definition: 'cramped:child:1',
          option: 'BUY_SEOUL',
          childSeq: 1,
          price: 900_000_000,
          regionName: '서울',
        }),
      ],
    })
    const lines = buildCredits(game).flatMap((s) => s.lines)
    expect(lines.find((l) => l.text === '33세, 서울 매수')?.sub).toBe(
      '첫째가 태어나 더 넓은 집으로 · 900,000,000원',
    )
    expect(lines.some((l) => l.text.startsWith('26세') || l.text.startsWith('30세'))).toBe(false)
  })
})

describe('가족 여행·집들이 그림, 집 그림은 매수만 (decisions.md 140번)', () => {
  it('가족 여행과 집들이에 그림이 붙고, 거절·생략·아이 나들이는 크레딧에 남지 않는다 (decisions.md 193번)', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('MARRIAGE', 29, { cost: 30_000_000 }),
        entry('LIFE', 32, {
          noticeCode: 'family-trip',
          title: '가족 여행',
          amount: -2_500_000,
          option: 'normal',
          proposer: '배우자',
        }),
        entry('LIFE', 36, {
          noticeCode: 'family-trip',
          title: '가족 여행',
          amount: 0,
          option: 'none',
          proposer: '부모님',
        }),
        entry('LIFE', 40, {
          noticeCode: 'housewarming',
          title: '집들이',
          amount: -2_000_000,
          option: 'luxury',
        }),
        entry('LIFE', 41, {
          noticeCode: 'kid-outing',
          title: '동물원',
          amount: -150_000,
          option: 'normal',
          proposer: '첫째',
        }),
        entry('END', 70, {}),
      ],
    })
    const sections = buildCredits(game)
    const trip = sections.find((s) => s.key === `trip-${game.log[2].seq}`)
    expect(trip?.art?.vignette).toBe('trip')
    expect(trip?.art?.figures.map((f) => f.who)).toEqual(['me', 'spouse'])
    expect(trip?.lines).toEqual([{ text: '32세, 가족 여행 (보통)', sub: '2,500,000원' }])
    const warming = sections.find((s) => s.key === `housewarming-${game.log[4].seq}`)
    expect(warming?.art?.vignette).toBe('family')
    expect(warming?.lines[0]).toMatchObject({
      text: '40세, 새집 집들이 (크게)',
      sub: '2,000,000원',
    })
    // 아이 나들이는 자주 있어 크레딧에 남지 않는다.
    expect(warming?.lines).toHaveLength(1)
  })

  it('월세·전세 이사는 크레딧에 남지 않고, 아파트 매수에만 그림과 함께 장이 열린다', () => {
    const game = baseGame({
      log: [
        entry('BIRTH', 15, {}),
        entry('HOUSING', 26, {
          option: 'MONTHLY',
          label: '월세 원룸',
          price: 0,
          deposit: 5_000_000,
        }),
        entry('HOUSING', 30, { option: 'APT_JEONSE', label: '아파트 전세', price: 0, deposit: 1 }),
        entry('HOUSING', 36, {
          option: 'BUY_GYEONGGI',
          label: '경기 매수',
          price: 500_000_000,
          regionName: '경기',
        }),
        entry('END', 70, {}),
      ],
    })
    const sections = buildCredits(game)
    expect(sections.filter((s) => s.art?.vignette === 'oneroom')).toHaveLength(0)
    expect(sections.find((s) => s.key === 'born')?.lines.map((l) => l.text)).toEqual([
      '15세, 태어났다',
    ])
    const bought = sections.find((s) => s.key === `home-${game.log[3].seq}`)
    expect(bought?.art?.vignette).toBe('new-home')
    expect(bought?.lines[0].text).toBe('36세, 경기 매수')
  })
})
