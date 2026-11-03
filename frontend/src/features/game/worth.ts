import type { Game } from '../../api/client'

/** 전 재산을 이루는 항목. 순서가 곧 막대에서의 순서이고 색 자리다 (#210). */
export type WorthKey = 'cash' | 'stocks' | 'homes' | 'deposit' | 'debt'

export interface WorthPart {
  key: WorthKey
  label: string
  /** 원. 빚은 음수 */
  value: number
}

/** 막대 색. 항목마다 고정이고 순위로 바뀌지 않는다. 빚은 막대 밖에서 빨간 펜으로. */
export const WORTH_COLORS: Record<Exclude<WorthKey, 'debt'>, string> = {
  cash: '#2a78d6',
  stocks: '#eb6834',
  homes: '#1baf7a',
  deposit: '#eda100',
}

/**
 * 서버의 전 재산(현금 + 주식 − 빚 + 집 지분, HousingFlow.equity)을 항목으로 나눈다.
 * 부동산은 집마다 시세 − 주담대 − 세입자 보증금, 보증금은 전·월세 보증금 − 전세대출이다. 합은 전 재산과 같다.
 */
export function worthParts(game: Game): WorthPart[] {
  const h = game.housing
  const homes = h.homes.reduce(
    (sum, home) => sum + home.price - home.mortgage - home.tenantDeposit,
    0,
  )
  return [
    { key: 'cash', label: '현금', value: game.cash },
    { key: 'stocks', label: '주식', value: game.invested },
    { key: 'homes', label: '부동산', value: homes },
    { key: 'deposit', label: '보증금', value: h.deposit - h.jeonseLoan },
    { key: 'debt', label: '빚', value: -game.debt },
  ]
}

export interface WorthBar {
  /** 막대에 쌓는 플러스 항목. share는 플러스 합에 대한 만분율 */
  plus: (WorthPart & { share: number })[]
  /** 빚, 시세보다 대출이 많은 집처럼 전 재산을 깎는 항목. share는 같은 플러스 합에 대한 만분율 */
  minus: (WorthPart & { share: number })[]
  /** 플러스 항목의 합(총자산) */
  gross: number
}

/** 0원인 항목은 빼고, 플러스는 막대로, 마이너스는 따로 둔다. */
export function worthBar(parts: WorthPart[]): WorthBar {
  const plus = parts.filter((p) => p.value > 0)
  const minus = parts.filter((p) => p.value < 0)
  const gross = plus.reduce((sum, p) => sum + p.value, 0)
  const share = (v: number) => (gross > 0 ? Math.round((Math.abs(v) * 10_000) / gross) : 0)
  return {
    plus: plus.map((p) => ({ ...p, share: share(p.value) })),
    minus: minus.map((p) => ({ ...p, share: share(p.value) })),
    gross,
  }
}

/** 주식 전체의 평가손익. 원가 = 평가액 − 손익 */
export function stockSummary(game: Game): { value: number; pnl: number; pnlBp: number } {
  const value = game.holdings.reduce((sum, h) => sum + h.value, 0)
  const pnl = game.holdings.reduce((sum, h) => sum + h.pnl, 0)
  const cost = value - pnl
  return { value, pnl, pnlBp: cost > 0 ? Math.round((pnl * 10_000) / cost) : 0 }
}

/** 탭 아래처럼 좁은 자리의 금액: 1억 이상은 "4.6억", 1만 이상은 "310만" (#212). */
export function compactWon(amount: number, signed = false): string {
  const sign = amount < 0 ? '−' : signed && amount > 0 ? '+' : ''
  const abs = Math.abs(amount)
  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000
    return `${sign}${eok >= 100 ? Math.round(eok).toLocaleString('ko-KR') : Number(eok.toFixed(1))}억`
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 10_000).toLocaleString('ko-KR')}만`
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`
}
