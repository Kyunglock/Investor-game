import { describe, expect, it } from 'vitest'
import { passersOf, seasonOf, weatherOf } from './StreetLife'

describe('살아 있는 거리 (#597, decisions.md 432번)', () => {
  it('분기가 없어져 날씨는 늘 맑다 (#803)', () => {
    expect(weatherOf()).toBe('sunny')
  })

  it('계절은 달력의 달을 따른다', () => {
    expect([3, 4, 5].map(seasonOf)).toEqual(['spring', 'spring', 'spring'])
    expect([6, 7, 8].map(seasonOf)).toEqual(['summer', 'summer', 'summer'])
    expect([9, 10, 11].map(seasonOf)).toEqual(['autumn', 'autumn', 'autumn'])
    expect([12, 1, 2].map(seasonOf)).toEqual(['winter', 'winter', 'winter'])
  })

  it('회사가 클수록 행인이 많다(2~6)', () => {
    expect(passersOf('F')).toBe(2)
    expect(passersOf('C')).toBe(3)
    expect(passersOf('SSS')).toBe(6)
    expect(passersOf('GOD')).toBe(6)
  })
})
