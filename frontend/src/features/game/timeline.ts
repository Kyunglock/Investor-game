import type { YearlyAsset } from '../../api/client'

/** 인생 지도와 자산 곡선의 계산 (설계 5.2절). 서버의 연간 자산(Game.yearly)만 쓴다. */
export type YearFill = 'empty' | 'up' | 'flat' | 'current' | 'end'

/**
 * 한 칸 = 1년, index 0 = startAge. 지난 해는 전년보다 늘었으면 up, 아니면 flat.
 * 현재 나이는 current, 끝 나이는 end (현재가 끝이면 current).
 */
export function yearFills(
  yearly: YearlyAsset[],
  initialAsset: number,
  currentAge: number,
  startAge: number,
  endAge: number,
): YearFill[] {
  const byAge = new Map(yearly.map((y) => [y.age, y.totalAsset]))
  const fills: YearFill[] = []
  let previous = initialAsset
  for (let age = startAge; age <= endAge; age++) {
    if (age === currentAge) {
      fills.push('current')
    } else if (age === endAge) {
      fills.push('end')
    } else {
      const total = byAge.get(age)
      if (total === undefined || age > currentAge) {
        fills.push('empty')
      } else {
        fills.push(total > previous ? 'up' : 'flat')
      }
    }
    const total = byAge.get(age)
    if (total !== undefined) {
      previous = total
    }
  }
  return fills
}

export interface CurvePoint {
  age: number
  totalAsset: number
}

/** 첫 점은 시작 나이의 초기 자산, 그 뒤는 마친 해마다 한 점. */
export function curvePoints(
  yearly: YearlyAsset[],
  initialAsset: number,
  startAge: number,
  currentAge: number,
): CurvePoint[] {
  const points: CurvePoint[] = [{ age: startAge, totalAsset: initialAsset }]
  for (const y of yearly) {
    if (y.age <= currentAge && y.age > startAge) {
      points.push({ age: y.age, totalAsset: y.totalAsset })
    } else if (y.age === startAge) {
      points[0] = { age: startAge, totalAsset: y.totalAsset }
    }
  }
  return points
}

/** 지난 한 해의 자산 변화. 마친 해가 둘 이상이어야 있고, 그 전에는 null (decisions.md 74번). */
export interface YearDelta {
  /** 마친 나이 */
  age: number
  delta: number
  /** 변화율(만분율). 전년 자산이 0 이하면 0 */
  bp: number
}

/**
 * 가계부의 "작년 한 해 +얼마". 달마다 바뀌는 "지난달보다"는 읽기도 전에 지나가서, 한 해를 마칠 때만 바뀌는 숫자로 (decisions.md 74번).
 * 첫 해(initialAsset)부터 셀 수 있게 시작 자산을 0세 전 자산으로 본다.
 */
export function yearDelta(yearly: YearlyAsset[], initialAsset: number): YearDelta | null {
  if (yearly.length === 0) {
    return null
  }
  const last = yearly[yearly.length - 1]
  const before = yearly.length >= 2 ? yearly[yearly.length - 2].totalAsset : initialAsset
  const delta = last.totalAsset - before
  const bp = before > 0 ? Math.round((delta * 10_000) / before) : 0
  return { age: last.age, delta, bp }
}
