import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { logLine, logLines } from './log'

// 시작 능력치는 등급 띠 안에서 뽑힌다 (grade.ts).
const initialStats: Stats = { insight: 42, patience: 61, courage: 19, conviction: 35, luck: 57 }
const game = { startAge: 1, daysPerYear: 360, initialStats }

const entry = (
  kind: LogEntry['kind'],
  day: number,
  payload: Record<string, unknown>,
): LogEntry => ({
  seq: 1,
  day,
  kind,
  payload,
})

describe('logLine', () => {
  it('탄생: 능력치와 별명', () => {
    const line = logLine(entry('BIRTH', 0, { stats: initialStats, initialAsset: 1000000 }), game)
    expect(line.text).toBe(
      "2025년, 안목 C 42 · 인내심 A 61 · 용기 F 19 · 줏대 D 35 · 운 B 57을 타고났다. 별명은 '겁 많은 돌부처'.",
    )
    expect(line.tone).toBe('birth')
    expect(line.pill).toBe('탄생')
    expect(line.age).toBe(1)
  })

  it('나이는 startAge + floor(day / daysPerYear)', () => {
    expect(logLine(entry('JOB', 23 * 360 + 359, {}), game).age).toBe(24)
  })

  it('뉴스: 뒤집히면 실제 행동과 원인이 붙는다', () => {
    const line = logLine(
      entry('NEWS', 30 * 360, {
        eventTitle: 'AI 서버 수요 폭증',
        chosen: 'BUY',
        actual: 'HOLD',
        deviations: [{ statCode: 'courage', from: 'BUY', to: 'HOLD' }],
      }),
      game,
    )
    expect(line.text).toBe('AI 서버 수요 폭증 · 선택 매수 → 실제 관망 (용기 부족)')
    expect(line.tone).toBe('flipped')
  })

  it('뉴스: 뒤집히지 않으면 선택만', () => {
    const line = logLine(
      entry('NEWS', 30 * 360, {
        eventTitle: '반도체 호재',
        chosen: 'BUY',
        actual: 'BUY',
        deviations: [],
      }),
      game,
    )
    expect(line.text).toBe('반도체 호재 · 매수')
    expect(line.tone).toBe('decision')
  })

  it('주가: 손익이 0이면 생략한다', () => {
    const base = { sectorName: '반도체', direction: 'UP', changeBp: 420, pnl: 0 }
    expect(logLine(entry('PRICE', 0, base), game).text).toBe('반도체 주가 ▲ 4.2%')
    expect(logLine(entry('PRICE', 0, { ...base, pnl: 1240000 }), game).text).toBe(
      '반도체 주가 ▲ 4.2% · 손익 +1,240,000원',
    )
    expect(
      logLine(entry('PRICE', 0, { ...base, direction: 'DOWN', changeBp: 150, pnl: -3000 }), game)
        .text,
    ).toBe('반도체 주가 ▼ 1.5% · 손익 -3,000원')
  })

  it('나머지 종류', () => {
    expect(
      logLine(entry('GROWTH', 0, { statCode: 'conviction', before: 51, after: 55 }), game),
    ).toMatchObject({ text: '경험으로 줏대 51 → 55 ↑', tone: 'growth' })
    expect(
      logLine(entry('JOB', 0, { jobTitle: '중소기업 사원', monthlySalary: 2800000 }), game).text,
    ).toBe('중소기업 사원에 취직했다. 첫 월급 2,800,000원.')
    expect(
      logLine(entry('STYLE', 0, { styleName: '장기 투자자', investorTypeName: '느긋한 농부' }), {
        ...game,
        interestSector: { code: 'food', name: '식품' },
      }).text,
    ).toBe("'느긋한 농부'형 투자자로 자랐다. 관심 분야는 식품.")
    expect(
      logLine(
        entry('OFFER', 0, { eventTitle: '친구의 권유', optionLabel: '투자를 시작한다' }),
        game,
      ),
    ).toMatchObject({ text: '친구의 권유 · 투자를 시작한다', pill: '제안', tone: 'offer' })
    expect(
      logLine(
        entry('TRAIT', 0, { eventTitle: '갖고 싶은 것 앞에서', optionLabel: '모았다가 산다' }),
        game,
      ),
    ).toMatchObject({ text: '갖고 싶은 것 앞에서 · 결정: 모았다가 산다', tone: 'decision' })
    expect(
      logLine(
        entry('END', 64 * 360, {
          finalAge: 65,
          initialAsset: 1000000,
          finalAsset: 48200000,
          returnBp: 472000,
        }),
        game,
      ),
    ).toMatchObject({
      text: '65세, 투자 인생을 마쳤다. 1,000,000원 → 48,200,000원 (+4720.0%)',
      tone: 'end',
    })
  })

  it('성향으로 능력치가 움직인 기록은 "그 선택으로"로 쓴다', () => {
    expect(
      logLine(
        entry('GROWTH', 0, { statCode: 'courage', before: 41, after: 42, reason: 'TRAIT' }),
        game,
      ).text,
    ).toBe('그 선택으로 용기 41 → 42 ↑')
  })

  it('능력치가 내려간 기록은 "↓"와 decline 톤이다', () => {
    const line = logLine(
      entry('GROWTH', 0, { statCode: 'patience', before: 41, after: 40, reason: 'TRAIT' }),
      game,
    )
    expect(line.text).toBe('그 선택으로 인내심 41 → 40 ↓')
    expect(line.tone).toBe('decline')
  })

  it('reason이 없는 옛 기록은 "경험으로"로 쓴다', () => {
    expect(
      logLine(entry('GROWTH', 0, { statCode: 'courage', before: 41, after: 42 }), game).text,
    ).toBe('경험으로 용기 41 → 42 ↑')
  })

  it('STYLE 기록에 유형 이름이 없는 옛 기록은 스타일 이름으로 쓴다', () => {
    expect(logLine(entry('STYLE', 0, { styleName: '장기 투자자' }), game).text).toBe(
      "'장기 투자자'형 투자자로 자랐다.",
    )
  })

  it('매매 체결: 종목·수량·금액, 매도면 실현 손익', () => {
    expect(
      logLine(
        entry('TRADE', 0, {
          stockName: '삼송전자',
          side: 'BUY',
          chosen: 'BUY',
          actual: 'BUY',
          deviations: [],
          status: 'EXECUTED',
          quantity: 20,
          price: 97_200,
          amount: 1_944_000,
        }),
        game,
      ),
    ).toMatchObject({ text: '삼송전자 20주 매수 (1,944,000원)', tone: 'decision' })
    expect(
      logLine(
        entry('TRADE', 0, {
          stockName: '오리옹',
          side: 'SELL',
          chosen: 'SELL',
          actual: 'SELL',
          deviations: [],
          status: 'EXECUTED',
          quantity: 4,
          price: 80_000,
          amount: 320_000,
          realizedPnl: 32_000,
        }),
        game,
      ).text,
    ).toBe('오리옹 4주 매도 (320,000원) · 실현 +32,000원')
  })

  it('매매 이탈: 못 샀다/못 팔았다와 원인', () => {
    const line = logLine(
      entry('TRADE', 0, {
        stockName: '크래프통',
        side: 'BUY',
        chosen: 'BUY',
        actual: 'HOLD',
        deviations: [{ statCode: 'courage', from: 'BUY', to: 'HOLD' }],
        status: 'HELD',
        quantity: 0,
        price: 250_000,
        amount: 0,
      }),
      game,
    )
    expect(line.text).toBe('크래프통 매수 → 못 샀다 (용기 부족)')
    expect(line.tone).toBe('flipped')
  })

  it('생활 기록: 알림·결혼·자녀·은퇴', () => {
    expect(logLine(entry('LIFE', 0, { title: '자동차 수리', amount: -800_000 }), game).text).toBe(
      '자동차 수리 · -800,000원',
    )
    expect(logLine(entry('LIFE', 0, { title: '명절 보너스', amount: 1_400_000 }), game).text).toBe(
      '명절 보너스 · +1,400,000원',
    )
    expect(logLine(entry('MARRIAGE', 0, { cost: 30_000_000 }), game).text).toBe(
      '결혼했다. 결혼 비용 30,000,000원.',
    )
    expect(logLine(entry('CHILD', 0, { seq: 2, cost: 3_000_000 }), game).text).toBe(
      '2번째 아이가 태어났다.',
    )
    expect(logLine(entry('RETIRE', 0, { age: 60, severance: 150_000_000 }), game).text).toBe(
      '60세, 은퇴했다. 퇴직금 150,000,000원.',
    )
  })

  it('뉴스·주가 기록은 종목명을 쓰고 섹터 전체면 덧붙인다', () => {
    expect(
      logLine(
        entry('PRICE', 0, {
          sectorName: '반도체',
          stockName: '삼송전자',
          sectorWide: false,
          direction: 'UP',
          changeBp: 420,
          pnl: 1_240_000,
        }),
        game,
      ).text,
    ).toBe('삼송전자 주가 ▲ 4.2% · 손익 +1,240,000원')
    expect(
      logLine(
        entry('PRICE', 0, {
          sectorName: '금융',
          stockName: 'KB금용',
          sectorWide: true,
          direction: 'DOWN',
          changeBp: 300,
          pnl: 0,
        }),
        game,
      ).text,
    ).toBe('KB금용 주가 ▼ 3.0% (금융 전체)')
  })

  it('모르는 종류는 죽지 않고 종류 이름을 보여 준다', () => {
    const line = logLine(entry('WEDDING' as LogEntry['kind'], 0, {}), game)
    expect(line.text).toBe('WEDDING')
    expect(line.tone).toBe('neutral')
  })
})

describe('logLines', () => {
  it('최근 순으로 뒤집는다', () => {
    const g = {
      ...game,
      log: [
        { seq: 1, day: 0, kind: 'BIRTH', payload: { stats: initialStats, initialAsset: 1 } },
        { seq: 2, day: 100, kind: 'TRAIT', payload: { eventTitle: 'a', optionLabel: 'b' } },
      ],
    } as unknown as Game
    expect(logLines(g).map((l) => l.seq)).toEqual([2, 1])
  })
})
