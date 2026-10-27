import { describe, expect, it } from 'vitest'
import type { components } from '../../src/api/schema.d.ts'
import { choose, freeTrade, PERSONAS, type Persona, seeded } from './personas.ts'

type Game = components['schemas']['Game']

const BASE: Persona = {
  code: 'test',
  newsBuy: 0,
  newsSellHeld: 0,
  trend: 'none',
  shakeHold: 0,
  leverageBorrow: 0,
  tradeChance: 0,
  tradeCashShare: 0.5,
  tradePick: 'random',
}

/** 선택 규칙이 읽는 필드만 채운 판. */
function game(overrides: Partial<Game>): Game {
  return {
    phase: 'INVESTING',
    cash: 1_000_000,
    holdings: [],
    household: { children: [] },
    market: {
      month: 0,
      stocks: [
        { code: 'up', price: 10_000, change12mBp: 3000 },
        { code: 'down', price: 20_000, change12mBp: -3000 },
      ],
    },
    ...overrides,
  } as unknown as Game
}

function event(kind: string, codes: string[], extra: object = {}): Game['pendingEvent'] {
  return {
    eventId: 'e',
    kind,
    options: codes.map((code) => ({ code, label: code })),
    ...extra,
  } as unknown as Game['pendingEvent']
}

describe('같은 시드', () => {
  it('같은 난수를 낸다', () => {
    const a = seeded(7)
    const b = seeded(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('뉴스', () => {
  it('흐름을 따르는 봇은 오르는 종목을 산다', () => {
    const g = game({
      pendingEvent: event('NEWS', ['BUY', 'SELL', 'HOLD'], { stockCode: 'up', spark: [100, 120] }),
    })
    expect(choose({ ...BASE, trend: 'follow' }, g, () => 0.5)).toBe('BUY')
  })

  it('거꾸로 가는 봇은 오르는 종목을 들고 있으면 판다', () => {
    const g = game({
      pendingEvent: event('NEWS', ['BUY', 'SELL', 'HOLD'], { stockCode: 'up', spark: [100, 120] }),
      holdings: [{ stockCode: 'up', quantity: 3 }] as Game['holdings'],
    })
    expect(choose({ ...BASE, trend: 'against' }, g, () => 0.5)).toBe('SELL')
  })

  it('들고 있지 않은 종목은 팔지 않는다', () => {
    const g = game({ pendingEvent: event('NEWS', ['BUY', 'SELL', 'HOLD'], { stockCode: 'up' }) })
    expect(choose({ ...BASE, newsSellHeld: 1 }, g, () => 0.5)).toBe('HOLD')
  })
})

describe('투자와 상관없는 장면', () => {
  it('직업은 전업투자자와 기다리기를 고르지 않는다', () => {
    const g = game({ pendingEvent: event('JOB', ['INVEST', 'clerk', 'WAIT']) })
    for (const r of [0, 0.5, 0.99]) {
      expect(choose(BASE, g, () => r)).toBe('clerk')
    }
  })

  it('막힌 선택지는 고르지 않는다', () => {
    const pending = event('HOUSING', [], {
      options: [
        { code: 'buy', label: 'buy', blocked: '현금 부족' },
        { code: 'rent', label: 'rent' },
      ],
    })
    expect(choose(BASE, game({ pendingEvent: pending }), () => 0)).toBe('rent')
  })
})

describe('자유 매매', () => {
  it('투자를 시작하기 전에는 하지 않는다', () => {
    expect(freeTrade({ ...BASE, tradeChance: 1 }, game({ phase: 'SAVING' }), () => 0)).toBeNull()
  })

  it('모멘텀 봇은 12달 가장 많이 오른 종목을 현금 비율만큼 산다', () => {
    const trade = freeTrade({ ...BASE, tradeChance: 1, tradePick: 'momentum' }, game({}), () => 0)
    expect(trade).toEqual({ stockCode: 'up', side: 'BUY', quantity: 50 })
  })

  it('페르소나 코드는 서버가 받는 형식이다', () => {
    for (const p of PERSONAS) {
      expect(p.code).toMatch(/^[a-z][a-z0-9-]{0,31}$/)
    }
  })
})
