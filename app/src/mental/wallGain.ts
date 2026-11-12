export interface WallGain {
  id: number
  amount: number
  start: number
}

/** 표시 중인 숫자는 유지하고, 빠르게 이어진 돌파는 다음 숫자 하나에 모은다. */
export function queueWallGain(queue: WallGain[], gain: WallGain): WallGain[] {
  if (queue.length < 2) return [...queue, gain]
  return [queue[0], { ...queue[1], amount: queue[1].amount + gain.amount }]
}

/** 연출 중인 벽 상승분만 보류한다. 잡몹 체결로 오른 가격은 즉시 보인다. */
export function shownPrice(price: number, queue: WallGain[]): number {
  return price - queue.reduce((sum, gain) => sum + gain.amount, 0)
}

/** 돌파한 벽의 비율이 아니라 종목 시작가 대비 실제 주가 상승률. */
export function priceRise(price: number, start: number): string {
  const percent = start > 0 ? ((price - start) / start) * 100 : 0
  return `${Math.round(percent * 10) / 10}%`
}
