import { describe, expect, it } from 'vitest'
import { chartPoints, drawProgress, tickerAt } from './InvestChart'

describe('앱 게임 차트 (decisions.md 297번)', () => {
  it('처음엔 가운데서 위아래로 크게 요동치고 끝은 결과 쪽 가장자리다', () => {
    for (const up of [true, false]) {
      for (let seed = 1; seed < 40; seed++) {
        const points = chartPoints(seed, up)
        const ys = points.map(([, y]) => y)
        const front = ys.slice(0, Math.floor(ys.length * 0.6))
        // 요동: 앞부분이 가운데(24) 위아래를 모두 지난다.
        expect(Math.max(...front)).toBeGreaterThan(28)
        expect(Math.min(...front)).toBeLessThan(20)
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
    // 시간의 앞 92%에 길이의 88%를, 뒤 8%에 나머지 12%를 그린다: 쭈욱이 요동보다 빠르다.
    expect(drawProgress(0.92)).toBeCloseTo(0.88, 5)
    expect(drawProgress(0.96) - drawProgress(0.92)).toBeGreaterThan(
      drawProgress(0.28) - drawProgress(0.24),
    )
  })
})
