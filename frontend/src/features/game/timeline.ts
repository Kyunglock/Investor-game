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
