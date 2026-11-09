import { describe, expect, it } from 'vitest'
import { passersOf, seasonOf, weatherOf } from './StreetLife'

describe('살아 있는 거리 (#597, decisions.md 432번)', () => {
  const q = (before: number, after: number, crash = false) =>
    ({ lastQuarter: { capitalBefore: before, capitalAfter: after, crash } }) as never

  it('날씨는 지난 분기 결과: 벌면 맑고, 잃으면 비, 폭락이면 먹구름, 아직 없으면 구름', () => {
    expect(weatherOf(q(100, 120))).toBe('sunny')
    expect(weatherOf(q(100, 80))).toBe('rain')
    expect(weatherOf(q(100, 120, true))).toBe('storm')
    expect(weatherOf(q(100, 100))).toBe('cloudy')
    expect(weatherOf({ lastQuarter: null } as never)).toBe('cloudy')
  })

  it('분기가 계절이고, 회사가 클수록 행인이 많다(2~6)', () => {
    expect([1, 2, 3, 4].map(seasonOf)).toEqual(['spring', 'summer', 'autumn', 'winter'])
    expect(passersOf('F')).toBe(2)
    expect(passersOf('C')).toBe(3)
    expect(passersOf('SSS')).toBe(6)
    expect(passersOf('GOD')).toBe(6)
  })
})
