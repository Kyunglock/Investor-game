/** 시장 패널과 포트폴리오의 순수 계산. 가격·판정은 서버에 있고 여기에는 표시용 계산만 있다 (경제 개편 설계 8.3절). */

export const BUY_PERCENTS = [10, 25, 50, 100] as const
export const SELL_PERCENTS = [25, 50, 100] as const

/** 현금의 percent%로 살 수 있는 수량(버림). 가격이 0 이하면 0. */
export function quantityForCash(cash: number, price: number, percent: number): number {
  if (price <= 0) {
    return 0
  }
  return Math.floor((cash * percent) / 100 / price)
}

/** 보유의 percent%(버림). 100이면 전량. */
export function quantityForHolding(held: number, percent: number): number {
  return percent >= 100 ? held : Math.floor((held * percent) / 100)
}

/** 변화율(만분율). 기준이 0 이하면 0. */
export function changeBp(now: number, before: number): number {
  if (before <= 0) {
    return 0
  }
  return Math.trunc(((now - before) * 10_000) / before)
}

/** '+2.3%' / '−1.8%' (마이너스는 U+2212). */
export function signedPercent(bp: number): string {
  const sign = bp > 0 ? '+' : bp < 0 ? '−' : ''
  return `${sign}${(Math.abs(bp) / 100).toFixed(1)}%`
}
