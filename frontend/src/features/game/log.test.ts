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

  it('전조는 무엇의 전조인지 말하지 않고, 위기는 끝난 뒤 이름과 지나간 전조를 함께 돌아본다', () => {
    const omen = logLine(
      entry('OMEN', 30 * 360, { text: '증시 거래량이 사상 최대를 기록했다.' }),
      game,
    )
    expect(omen.text).toBe('증시 거래량이 사상 최대를 기록했다.')
    expect(omen.pill).toBe('세상')

    const crisis = logLine(
      entry('CRISIS', 35 * 360, {
        name: '기술주 버블 붕괴',
        model: '2000년 IT 버블',
        severity: 'DEPRESSION',
        startAge: 32,
        endAge: 36,
        dropBp: 5_400,
        omens: ['증시 거래량이 사상 최대를 기록했다.'],
      }),
      game,
    )
    expect(crisis.tone).toBe('decline')
    expect(crisis.text).toContain('돌아보니 32~36세의 그 시절은 기술주 버블 붕괴, 대공황이었다.')
    expect(crisis.text).toContain('"증시 거래량이 사상 최대를 기록했다."')

    const silent = logLine(
      entry('CRISIS', 35 * 360, {
        name: '외환 위기',
        model: '1997년 IMF 외환위기',
        severity: 'RECESSION',
        startAge: 40,
        endAge: 42,
        dropBp: 2_500,
        omens: [],
      }),
      game,
    )
    expect(silent.text).toContain('외환 위기, 불황이었다')
    expect(silent.text).toContain('아무 전조도 없이 왔다.')
  })

  it('성향 장면: 결과가 갈리면 어떻게 됐는지 덧붙인다', () => {
    const line = logLine(
      entry('TRAIT', 30 * 360, {
        eventTitle: '친한 동료가 "급해서 그런데 500만 원만" 한다',
        optionLabel: '빌려준다',
        result: '500만 원은 돌아오지 않았다.',
      }),
      game,
    )
    expect(line.text).toBe(
      '친한 동료가 "급해서 그런데 500만 원만" 한다 · 결정: 빌려준다 → 500만 원은 돌아오지 않았다.',
    )
  })

  it('청약: 떨어짐·당첨 뒤 포기·당첨', () => {
    const at = (payload: Record<string, unknown>) =>
      logLine(entry('HOUSING', 30 * 360, { option: 'APPLY', ...payload }), game).text
    expect(at({ won: false, points: 42 })).toBe('청약에 떨어졌다 (가점 42점).')
    expect(at({ won: true, bought: false, points: 64 })).toBe(
      '청약에 당첨됐지만 계약금이 모자라 포기했다 (가점 64점).',
    )
    expect(
      at({
        won: true,
        bought: true,
        points: 71,
        regionName: '서울 아파트 (84㎡)',
        price: 700_000_000,
      }),
    ).toBe('청약에 당첨됐다 (가점 71점)! 서울 아파트 (84㎡)를 분양가 700,000,000원에 샀다.')
  })

  it('집: 매수·전세사기·매도·역전세', () => {
    const bought = logLine(
      entry('HOUSING', 30 * 360, {
        option: 'BUY_SEOUL',
        regionName: '서울 아파트 (84㎡)',
        price: 1_000_000_000,
        mortgage: 500_000_000,
        fraud: false,
      }),
      game,
    )
    expect(bought.text).toBe('서울 아파트 (84㎡)를 1,000,000,000원에 샀다 (주담대 500,000,000원).')
    expect(bought.pill).toBe('집')

    const fraud = logLine(
      entry('HOUSING', 30 * 360, {
        option: 'MONTHLY',
        label: '월세로 산다',
        deposit: 10_000_000,
        monthlyRent: 600_000,
        price: 0,
        fraud: true,
        lost: 150_000_000,
      }),
      game,
    )
    expect(fraud.tone).toBe('flipped')
    expect(fraud.text).toContain('전세사기를 당했다. 보증금 150,000,000원을 돌려받지 못했다.')

    const sold = logLine(
      entry('HOME_SOLD', 40 * 360, {
        regionName: '경기 아파트 (84㎡)',
        price: 700_000_000,
        purchasePrice: 600_000_000,
        residence: true,
      }),
      game,
    )
    expect(sold.text).toContain('+100,000,000원')
    expect(sold.text).toContain('살 곳을 새로 구해야 한다')

    const reverse = logLine(
      entry('TENANT', 40 * 360, { regionName: '서울', before: 500_000_000, after: 450_000_000 }),
      game,
    )
    expect(reverse.text).toContain('50,000,000원을 돌려줬다 (역전세)')
  })

  it('빚투: 빌렸으면 금액과 수량, 안 빌렸으면 그렇다고', () => {
    const borrowed = logLine(
      entry('LEVERAGE', 30 * 360, {
        stockName: '삼송전자',
        dropBp: 3_500,
        borrowed: true,
        loan: 50_000_000,
        quantity: 700,
      }),
      game,
    )
    expect(borrowed.text).toContain('50,000,000원을 빌려 700주를 더 샀다 (빚투)')
    const passed = logLine(
      entry('LEVERAGE', 30 * 360, { stockName: '삼송전자', dropBp: 3_500, borrowed: false }),
      game,
    )
    expect(passed.text).toContain('빚은 지지 않았다')
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

  it('흔들림: 버틴다를 골랐는데 인내심 부족으로 팔았다', () => {
    const line = logLine(
      entry('SHAKE', 32 * 360, {
        eventTitle: '한빛반도체 급락 알림',
        chosen: 'HOLD',
        actual: 'SELL',
        deviations: [{ statCode: 'patience', from: 'HOLD', to: 'SELL' }],
      }),
      game,
    )
    expect(line.text).toBe('한빛반도체 급락 알림 · 선택 버틴다 → 실제 판다 (인내심 부족)')
    expect(line.tone).toBe('flipped')
    expect(
      logLine(
        entry('SHAKE', 32 * 360, {
          eventTitle: '지루한 보유',
          chosen: 'HOLD',
          actual: 'HOLD',
          deviations: [],
        }),
        game,
      ).text,
    ).toBe('지루한 보유 · 버틴다')
  })

  it('종료(파산): 빚과 나이', () => {
    const line = logLine(
      entry('END', 43 * 360, {
        finalAge: 44,
        ending: 'BANKRUPT',
        debt: 12_000_000,
        initialAsset: 1_000_000,
        finalAsset: -12_000_000,
        returnBp: -13_000,
      }),
      game,
    )
    expect(line.text).toBe(
      '44세, 빚 12,000,000원을 갚지 못해 파산했다. 1,000,000원 → -12,000,000원 (-130.0%)',
    )
    expect(line.tone).toBe('end')
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

describe('직장 기록', () => {
  it('재취업·기다림·직장 장면 줄', () => {
    expect(
      logLine(
        entry('JOB', 3600, { jobTitle: '개발자', monthlySalary: 3500000, rehire: true }),
        game,
      ).text,
    ).toBe('개발자(으)로 다시 취직했다. 월급 3,500,000원.')
    expect(logLine(entry('JOB_WAIT', 3600, {}), game).text).toBe('더 나은 자리를 기다리기로 했다.')
    const career = logLine(
      entry('CAREER', 4000, {
        eventTitle: '연봉 협상',
        optionLabel: '세게 요구한다',
        success: false,
        text: '분위기만 싸해졌다.',
      }),
      game,
    )
    expect(career.text).toBe('연봉 협상 · 세게 요구한다 → 분위기만 싸해졌다.')
    expect(career.tone).toBe('flipped')
    expect(career.pill).toBe('직장')

    const investor = logLine(
      entry('CAREER', 4100, {
        eventTitle: '주식 유튜브',
        optionLabel: '채널을 연다',
        success: true,
        text: '구독자 10만.',
        fullTimeInvestor: true,
      }),
      game,
    )
    expect(investor.pill).toBe('투자')
  })
})
