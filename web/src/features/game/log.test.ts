import { describe, expect, it } from 'vitest'
import type { Game, LogEntry, Stats } from '../../api/client'
import { logLine, logLines } from './log'

const initialStats: Stats = { insight: 62, patience: 81, courage: 34, conviction: 55, luck: 47 }
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
      "2025년, 안목 62 · 인내심 81 · 용기 34 · 줏대 55 · 운 47을 타고났다. 별명은 '겁 많은 돌부처'.",
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
    expect(logLine(entry('STYLE', 0, { styleName: '장기 투자형' }), game).text).toBe(
      "투자 스타일이 '장기 투자형'로 굳었다.",
    )
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
