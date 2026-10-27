import type { components } from '../../src/api/schema.d.ts'

// 봇 플레이어의 선택 규칙 (행동 프로필·봇 설계 4절). 규칙은 화면이 보는 것(대기 이벤트, 시세, 보유)만 보고 고른다.
// 숨은 방향은 모르므로 결과는 실제 게임 규칙에서 나온다.

type Game = components['schemas']['Game']

/** 0 이상 1 미만. 같은 시드면 같은 판을 같은 식으로 플레이한다. */
export type Random = () => number

export function seeded(seed: number): Random {
  // mulberry32
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Persona {
  code: string
  /** 뉴스 앞에서 살 확률 */
  newsBuy: number
  /** 그 종목을 들고 있을 때 뉴스 앞에서 팔 확률 */
  newsSellHeld: number
  /** follow: 최근 12달이 오르면 사고 내리면 판다. against: 그 반대. none: 흐름을 보지 않는다 */
  trend: 'follow' | 'against' | 'none'
  /** 흔들림 앞에서 버틸 확률 */
  shakeHold: number
  /** 빚투 제안을 받아들일 확률 */
  leverageBorrow: number
  /** 시각을 보고할 때마다(최대 90일) 자유 매매를 할 확률 */
  tradeChance: number
  /** 자유 매매로 살 때 쓰는 현금 비율 */
  tradeCashShare: number
  /** momentum: 12달 많이 오른 종목을 사고 손실 난 종목을 판다. dip: 많이 빠진 종목을 사고 수익 난 종목을 판다 */
  tradePick: 'momentum' | 'dip' | 'random'
}

export const PERSONAS: readonly Persona[] = [
  {
    code: 'panic',
    newsBuy: 0.2,
    newsSellHeld: 0.7,
    trend: 'none',
    shakeHold: 0.2,
    leverageBorrow: 0,
    tradeChance: 0.05,
    tradeCashShare: 0.2,
    tradePick: 'random',
  },
  {
    code: 'holder',
    newsBuy: 0.7,
    newsSellHeld: 0,
    trend: 'none',
    shakeHold: 0.95,
    leverageBorrow: 0,
    tradeChance: 0.02,
    tradeCashShare: 0.3,
    tradePick: 'random',
  },
  {
    code: 'chaser',
    newsBuy: 0.4,
    newsSellHeld: 0.4,
    trend: 'follow',
    shakeHold: 0.4,
    leverageBorrow: 0.2,
    tradeChance: 0.3,
    tradeCashShare: 0.3,
    tradePick: 'momentum',
  },
  {
    code: 'contrarian',
    newsBuy: 0.4,
    newsSellHeld: 0.4,
    trend: 'against',
    shakeHold: 0.85,
    leverageBorrow: 0.5,
    tradeChance: 0.2,
    tradeCashShare: 0.3,
    tradePick: 'dip',
  },
  {
    code: 'leverager',
    newsBuy: 0.8,
    newsSellHeld: 0.1,
    trend: 'none',
    shakeHold: 0.6,
    leverageBorrow: 1,
    tradeChance: 0.1,
    tradeCashShare: 0.5,
    tradePick: 'momentum',
  },
  {
    code: 'watcher',
    newsBuy: 0.05,
    newsSellHeld: 0.05,
    trend: 'none',
    shakeHold: 0.7,
    leverageBorrow: 0,
    tradeChance: 0.01,
    tradeCashShare: 0.1,
    tradePick: 'random',
  },
  {
    code: 'trader',
    newsBuy: 0.45,
    newsSellHeld: 0.45,
    trend: 'none',
    shakeHold: 0.4,
    leverageBorrow: 0.3,
    tradeChance: 0.8,
    tradeCashShare: 0.3,
    tradePick: 'random',
  },
  {
    code: 'diversifier',
    newsBuy: 0.5,
    newsSellHeld: 0.05,
    trend: 'none',
    shakeHold: 0.9,
    leverageBorrow: 0,
    tradeChance: 0.4,
    tradeCashShare: 0.1,
    tradePick: 'random',
  },
]

/** 확률을 ±0.1 흔들어 같은 페르소나 안에서도 판마다 조금씩 다르게 한다. */
export function jitter(persona: Persona, random: Random): Persona {
  const shake = (p: number) => Math.min(1, Math.max(0, p + (random() - 0.5) * 0.2))
  return {
    ...persona,
    newsBuy: shake(persona.newsBuy),
    newsSellHeld: shake(persona.newsSellHeld),
    shakeHold: shake(persona.shakeHold),
    leverageBorrow: shake(persona.leverageBorrow),
    tradeChance: shake(persona.tradeChance),
  }
}

/** 대기 중인 이벤트에 낼 선택지 코드. 투자와 상관없는 장면은 판이 70세까지 이어지도록 무난하게 고른다. */
export function choose(persona: Persona, game: Game, random: Random): string {
  const event = game.pendingEvent
  if (!event) {
    throw new Error('대기 중인 이벤트가 없다')
  }
  const open = event.options.filter((o) => o.blocked == null)
  const codes = open.map((o) => o.code)
  switch (event.kind) {
    case 'NEWS':
      return newsChoice(persona, game, random)
    case 'SHAKE':
      return random() < persona.shakeHold ? 'HOLD' : 'SELL'
    case 'LEVERAGE':
      return random() < persona.leverageBorrow ? 'BORROW' : 'PASS'
    case 'OFFER':
      return 'accept'
    // 성향 장면은 고르게 뽑아 투자 스타일·관심 섹터가 섞이게 한다.
    case 'TRAIT':
      return pick(open, random).code
    // 전업투자자(INVEST)는 월급이 없어 투자 습관보다 생활비가 결과를 정한다. 기다리기(WAIT)는 판만 늦춘다.
    case 'JOB': {
      const jobs = open.filter((o) => o.code !== 'INVEST' && o.code !== 'WAIT')
      return (jobs.length > 0 ? pick(jobs, random) : open[0]).code
    }
    case 'LIFE':
      if (codes.includes('normal')) return 'normal'
      if (codes.includes('half')) return 'half'
      if (codes.includes('accept')) {
        return game.household.children.length < 2 ? 'accept' : 'decline'
      }
      return codes[0]
    default:
      return codes[0]
  }
}

function newsChoice(persona: Persona, game: Game, random: Random): string {
  const event = game.pendingEvent
  const held = game.holdings.some((h) => h.stockCode === event?.stockCode && h.quantity > 0)
  const spark = event?.spark ?? []
  const rising = spark.length >= 2 && spark[spark.length - 1] > spark[0]
  let buy = persona.newsBuy
  let sell = held ? persona.newsSellHeld : 0
  if (persona.trend !== 'none' && spark.length >= 2) {
    const wantsUp = (persona.trend === 'follow') === rising
    buy = wantsUp ? Math.max(buy, 0.8) : 0
    sell = wantsUp || !held ? 0 : Math.max(sell, 0.8)
  }
  const r = random()
  if (r < buy) return 'BUY'
  if (r < Math.min(1, buy + sell)) return 'SELL'
  return 'HOLD'
}

export interface FreeTrade {
  stockCode: string
  side: 'BUY' | 'SELL'
  quantity: number
}

/** 시각을 보고하기 전에 할 자유 매매. 하지 않으면 null. */
export function freeTrade(persona: Persona, game: Game, random: Random): FreeTrade | null {
  if (game.phase !== 'INVESTING' || random() >= persona.tradeChance) {
    return null
  }
  const holdings = game.holdings.filter((h) => h.quantity > 0)
  if (holdings.length > 0 && random() >= 0.6) {
    const ranked = [...holdings].sort((a, b) => a.pnlBp - b.pnlBp)
    const target =
      persona.tradePick === 'momentum'
        ? ranked[0]
        : persona.tradePick === 'dip'
          ? ranked[ranked.length - 1]
          : pick(holdings, random)
    return { stockCode: target.stockCode, side: 'SELL', quantity: target.quantity }
  }
  const stocks = [...game.market.stocks].sort((a, b) => a.change12mBp - b.change12mBp)
  const target =
    persona.tradePick === 'momentum'
      ? stocks[stocks.length - 1]
      : persona.tradePick === 'dip'
        ? stocks[0]
        : pick(stocks, random)
  const quantity = Math.floor((game.cash * persona.tradeCashShare) / target.price)
  return quantity < 1 ? null : { stockCode: target.code, side: 'BUY', quantity }
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)]
}
