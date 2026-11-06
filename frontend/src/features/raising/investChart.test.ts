import { describe, expect, it } from 'vitest'
import { chartPoints, drawProgress, pointAt, smoothPath, tickerAt } from './InvestChart'

describe('앱 게임 차트 (decisions.md 297번)', () => {
  it('처음엔 가운데서 위아래로 크게 요동치고 끝은 결과 쪽 가장자리다', () => {
    for (const up of [true, false]) {
      for (let seed = 1; seed < 40; seed++) {
        const points = chartPoints(seed, up)
        const ys = points.map(([, y]) => y)
        const front = ys.slice(0, Math.floor(ys.length * 0.7))
        // 요동: 앞부분이 가운데(24) 위아래를 모두 크게 지나고, 가운데를 여러 번 넘나든다 (299번).
        expect(Math.max(...front)).toBeGreaterThan(30)
        expect(Math.min(...front)).toBeLessThan(18)
        let crossings = 0
        for (let i = 1; i < front.length; i++) {
          if (front[i - 1] > 24 !== front[i] > 24) {
            crossings++
          }
        }
        expect(crossings).toBeGreaterThanOrEqual(4)
        // 끝: 위든 아래든 가장자리.
        expect(ys[ys.length - 1]).toBe(up ? 2.5 : 45.5)
        // 같은 시드면 같은 모양.
        expect(chartPoints(seed, up)).toEqual(points)
      }
    }
  })

  it('가격 눈금은 가운데가 0, 끝이 ±1이고, 마지막 쭈욱은 몰아친다', () => {
    const points = chartPoints(7, true)
    expect(tickerAt(points, 1)).toBe(1)
    expect(tickerAt(chartPoints(7, false), 1)).toBe(-1)
    expect(Math.abs(tickerAt(points, 0))).toBeLessThan(0.3)
    expect(drawProgress(0)).toBe(0)
    expect(drawProgress(1)).toBe(1)
    // 시간의 앞 90%에 길이의 86%를, 뒤 10%에 나머지 14%를 그린다: 쭈욱이 요동보다 빠르다.
    expect(drawProgress(0.9)).toBeCloseTo(0.86, 5)
    expect(drawProgress(0.95) - drawProgress(0.9)).toBeGreaterThan(
      drawProgress(0.29) - drawProgress(0.24),
    )
  })
})

describe('부드러운 곡선 (decisions.md 299번)', () => {
  it('끊은 자리는 점 사이를 잇고, 곡선은 3차 베지에로 흐른다', () => {
    const points: [number, number][] = [
      [0, 24],
      [10, 30],
      [20, 10],
    ]
    expect(pointAt(points, 0)).toEqual([0, 24])
    expect(pointAt(points, 0.25)).toEqual([5, 27])
    expect(pointAt(points, 1)).toEqual([20, 10])
    const d = smoothPath(points)
    expect(d.startsWith('M0.00,24.00 C')).toBe(true)
    expect(d.split(' C')).toHaveLength(3)
    expect(d.endsWith('20.00,10.00')).toBe(true)
    expect(smoothPath([[0, 1]])).toBe('')
  })
})
