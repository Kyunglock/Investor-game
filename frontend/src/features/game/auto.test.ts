/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Game, PendingEvent } from '../../api/client'
import { autoChoice, buyPercent, hintDirection, salaryOf, seededRandom } from './auto'

const STATS = { insight: 50, patience: 50, courage: 50, conviction: 50, luck: 50 }

/** 자동 선택이 읽는 필드만 채운 판. */
function game(over: Partial<Game> = {}): Game {
  return {
    gameId: 'g',
    status: 'ACTIVE',
    phase: 'INVESTING',
    stats: STATS,
    cash: 10_000_000,
    totalAsset: 10_000_000,
    debt: 0,
    holdings: [],
    household: { children: [] },
    market: { month: 0, stocks: [{ code: 's', price: 10_000 }] },
    ...over,
  } as unknown as Game
}

function pending(
  kind: PendingEvent['kind'],
  codes: string[],
  extra: Partial<PendingEvent> = {},
): PendingEvent {
  return {
    eventId: 'e-1',
    kind,
    occursDay: 0,
    sectorWide: false,
    title: '',
    body: '',
    options: codes.map((code) => ({ code, label: code })),
    ...extra,
  } as PendingEvent
}

describe('힌트의 방향', () => {
  it('phrases.json의 모든 힌트 문구를 맞게 읽는다', () => {
    const phrases = JSON.parse(readFileSync('../content/phrases.json', 'utf-8')) as {
      hints: Record<string, Record<string, Record<string, string[]>>>
    }
    const wrong: string[] = []
    for (const [tier, byDirection] of Object.entries(phrases.hints)) {
      for (const [direction, byStrength] of Object.entries(byDirection)) {
        for (const texts of Object.values(byStrength)) {
          for (const text of texts) {
            const filled = text
              .replaceAll('{stock}', '엔씽')
              .replaceAll('{sectorName}', '게임')
              .replaceAll('{min}', '3')
              .replaceAll('{max}', '8')
            if (hintDirection(filled) !== direction) {
              wrong.push(`${tier}/${direction}: ${filled} → ${hintDirection(filled)}`)
            }
          }
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('힌트가 없으면 모른다', () => {
    expect(hintDirection(null)).toBeNull()
    expect(hintDirection('')).toBeNull()
  })
})

describe('같은 시드', () => {
  it('같은 난수를 내고, 다른 시드는 다른 수를 낸다', () => {
    const a = seededRandom('e-1')
    const b = seededRandom('e-1')
    const c = seededRandom('e-2')
    expect([a(), a()]).toEqual([b(), b()])
    expect(a()).not.toEqual(c())
  })
})

describe('뉴스', () => {
  const news = (hint: string | null, extra: Partial<PendingEvent> = {}) =>
    pending('NEWS', ['BUY', 'SELL', 'HOLD'], { stockCode: 's', hint, ...extra })

  it('오를 힌트면 현금 비율만큼 산다', () => {
    const g = game({ pendingEvent: news('이건 올라갈 것 같다') })
    // 보통 성향(공격 아님) 20%: 1,000만 × 20% ÷ 1만 = 200주
    expect(autoChoice(g)).toEqual({ option: 'BUY', quantity: 200 })
  })

  it('공격 성향에 용기가 있으면 더 많이 산다', () => {
    const g = game({
      riskProfile: { code: 'bold', name: '공격' },
      stats: { ...STATS, courage: 80 },
    })
    expect(buyPercent(g)).toBe(60)
  })

  it('내릴 힌트에 들고 있으면 팔고, 인내심이 있으면 절반만 판다', () => {
    const held = [{ stockCode: 's', quantity: 10 }] as Game['holdings']
    expect(autoChoice(game({ pendingEvent: news('이건 위험해 보인다'), holdings: held }))).toEqual({
      option: 'SELL',
      quantity: 10,
    })
    expect(
      autoChoice(
        game({
          pendingEvent: news('이건 위험해 보인다'),
          holdings: held,
          stats: { ...STATS, patience: 70 },
        }),
      ),
    ).toEqual({ option: 'SELL', quantity: 5 })
  })

  it('내릴 힌트인데 들고 있지 않으면 관망한다', () => {
    expect(autoChoice(game({ pendingEvent: news('꽤 불안한 냄새가 난다') }))).toEqual({
      option: 'HOLD',
    })
  })

  it('방향을 모르면 추종 성향은 흐름을 따르고 소신 성향은 관망한다', () => {
    const rising = news('잘 모르겠다', { spark: [100, 130] })
    expect(
      autoChoice(game({ pendingEvent: rising, mindProfile: { code: 'crowd', name: '추종' } })),
    ).toMatchObject({ option: 'BUY' })
    expect(
      autoChoice(game({ pendingEvent: rising, mindProfile: { code: 'own', name: '소신' } })),
    ).toEqual({ option: 'HOLD' })
  })

  it('한 주도 못 사면 관망한다', () => {
    expect(autoChoice(game({ pendingEvent: news('이건 올라갈 것 같다'), cash: 5_000 }))).toEqual({
      option: 'HOLD',
    })
  })
})

describe('흔들림과 빚투', () => {
  it('장기 성향이나 인내심이 있으면 버티고, 아니면 판다', () => {
    const shake = pending('SHAKE', ['HOLD', 'SELL'])
    expect(autoChoice(game({ pendingEvent: shake }))).toEqual({ option: 'HOLD' })
    expect(
      autoChoice(
        game({
          pendingEvent: shake,
          stats: { ...STATS, patience: 20 },
          investmentStyle: { code: 'short', name: '단기' },
        }),
      ),
    ).toEqual({ option: 'SELL' })
  })

  it('빚투는 공격 성향에 용기가 있고 빚이 없을 때만 상한의 30%를 빌린다', () => {
    const lev = pending('LEVERAGE', ['BORROW', 'PASS'], { stockCode: 's' })
    const bold = game({
      pendingEvent: lev,
      riskProfile: { code: 'bold', name: '공격' },
      stats: { ...STATS, courage: 70 },
    })
    // 순자산 1,000만 → 상한 500만 → 30% = 150만 ÷ 1만 = 150주
    expect(autoChoice(bold)).toEqual({ option: 'BORROW', quantity: 150 })
    expect(autoChoice({ ...bold, debt: 1 })).toEqual({ option: 'PASS' })
    expect(autoChoice(game({ pendingEvent: lev }))).toEqual({ option: 'PASS' })
  })
})

describe('투자와 상관없는 장면', () => {
  it('막힌 선택지는 고르지 않는다', () => {
    const g = game({
      pendingEvent: pending('HOUSING', [], {
        options: [
          { code: 'BUY_SEOUL', label: '', blocked: '현금 부족' },
          { code: 'VILLA', label: '' },
          { code: 'ENDURE', label: '' },
        ],
      }),
      riskProfile: { code: 'bold', name: '공격' },
    })
    expect(autoChoice(g)).toEqual({ option: 'VILLA' })
  })

  it('주거는 성향 순서대로, 좁아도 산다는 마지막이다', () => {
    const codes = ['MONTHLY', 'VILLA', 'VILLA_INSURED', 'APT_JEONSE', 'BUY_SEOUL', 'ENDURE']
    const safe = game({
      pendingEvent: pending('HOUSING', codes),
      riskProfile: { code: 'safe', name: '안정' },
    })
    const bold = game({
      pendingEvent: pending('HOUSING', codes),
      riskProfile: { code: 'bold', name: '공격' },
    })
    expect(autoChoice(safe)).toEqual({ option: 'APT_JEONSE' })
    expect(autoChoice(bold)).toEqual({ option: 'BUY_SEOUL' })
    expect(autoChoice(game({ pendingEvent: pending('HOUSING', ['ENDURE']) }))).toEqual({
      option: 'ENDURE',
    })
  })

  it('청약은 넣어 보고 다시 안 묻기는 고르지 않는다', () => {
    expect(
      autoChoice(game({ pendingEvent: pending('HOUSING', ['APPLY', 'PASS', 'NEVER']) })),
    ).toEqual({ option: 'APPLY' })
  })

  it('직업: 전업투자자와 기다리기는 피하고, 안목이 있으면 월급 높은 자리를 고른다', () => {
    const job = pending('JOB', [], {
      options: [
        { code: 'INVEST', label: '직장 대신 전업투자자가 된다' },
        { code: 'office', label: '사무직 · 월 280만 원' },
        { code: 'nurse', label: '간호사 · 월 310만 원' },
        { code: 'WAIT', label: '더 나은 자리를 기다린다' },
      ],
    })
    expect(autoChoice(game({ pendingEvent: job, stats: { ...STATS, insight: 80 } }))).toEqual({
      option: 'nurse',
    })
    const low = autoChoice(game({ pendingEvent: job, stats: { ...STATS, insight: 20 } }))
    expect(['office', 'nurse']).toContain(low?.option)
    expect(salaryOf('대기업 사무직 · 월 1,200만 원')).toBe(1200)
  })

  it('직장: 용기가 높으면 나서는 쪽, 낮으면 지키는 쪽', () => {
    const career = pending('CAREER', ['move', 'counter', 'stay'])
    expect(autoChoice(game({ pendingEvent: career, stats: { ...STATS, courage: 20 } }))).toEqual({
      option: 'stay',
    })
    const brave = autoChoice(game({ pendingEvent: career, stats: { ...STATS, courage: 80 } }))
    expect(['move', 'counter']).toContain(brave?.option)
  })

  it('생활: 둘째까지 받아들이고, 자녀 결혼은 절반, 나들이는 현금을 보고 보통이나 싸게', () => {
    const marriage = pending('LIFE', ['accept', 'decline'])
    expect(autoChoice(game({ pendingEvent: marriage }))).toEqual({ option: 'accept' })
    expect(
      autoChoice(
        game({
          pendingEvent: marriage,
          household: { children: [{}, {}] } as unknown as Game['household'],
        }),
      ),
    ).toEqual({ option: 'decline' })
    expect(autoChoice(game({ pendingEvent: pending('LIFE', ['full', 'half', 'none']) }))).toEqual({
      option: 'half',
    })
    const trip = pending('LIFE', ['luxury', 'normal', 'cheap', 'none'])
    expect(autoChoice(game({ pendingEvent: trip }))).toEqual({ option: 'normal' })
    expect(autoChoice(game({ pendingEvent: trip, cash: 500_000 }))).toEqual({ option: 'cheap' })
  })

  it('투자 제안은 받아들이고, 일상 장면은 같은 이벤트면 같은 것을 고른다', () => {
    expect(autoChoice(game({ pendingEvent: pending('OFFER', ['accept', 'decline']) }))).toEqual({
      option: 'accept',
    })
    const trait = game({ pendingEvent: pending('TRAIT', ['a', 'b', 'c', 'd']) })
    expect(autoChoice(trait)).toEqual(autoChoice(trait))
  })

  it('대기 중인 선택이 없으면 null', () => {
    expect(autoChoice(game())).toBeNull()
  })
})
