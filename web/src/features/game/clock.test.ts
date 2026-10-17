import { describe, expect, it } from 'vitest'
import {
  advanceDay,
  ageAt,
  REPORT_EVERY_DAYS,
  SECONDS_PER_YEAR,
  shouldReport,
  totalDays,
} from './clock'

const DAYS_PER_YEAR = 360

describe('advanceDay', () => {
  it('1배속으로 1년치 시간이 흐르면 360일이 지난다', () => {
    expect(advanceDay(0, SECONDS_PER_YEAR * 1000, 1, DAYS_PER_YEAR, 14_400)).toBeCloseTo(360)
  })

  it('2배속이면 두 배로 흐른다', () => {
    expect(advanceDay(0, SECONDS_PER_YEAR * 1000, 2, DAYS_PER_YEAR, 14_400)).toBeCloseTo(720)
  })

  it('마지막 날을 넘지 않는다', () => {
    expect(advanceDay(14_390, 60_000, 2, DAYS_PER_YEAR, 14_400)).toBe(14_400)
  })
})

describe('shouldReport', () => {
  it('보고 간격에 도달하면 보고한다', () => {
    expect(shouldReport(REPORT_EVERY_DAYS - 0.1, 0)).toBe(false)
    expect(shouldReport(REPORT_EVERY_DAYS, 0)).toBe(true)
  })
})

describe('ageAt', () => {
  it('시작 나이에서 일수만큼 나이와 개월을 계산한다', () => {
    expect(ageAt(25, 0, DAYS_PER_YEAR)).toEqual({ years: 25, months: 0 })
    expect(ageAt(25, 359, DAYS_PER_YEAR)).toEqual({ years: 25, months: 11 })
    expect(ageAt(25, 360, DAYS_PER_YEAR)).toEqual({ years: 26, months: 0 })
    expect(ageAt(25, 375.9, DAYS_PER_YEAR)).toEqual({ years: 26, months: 0 })
  })
})

describe('totalDays', () => {
  it('25세에서 65세까지는 14,400일이다', () => {
    expect(totalDays(25, 65, DAYS_PER_YEAR)).toBe(14_400)
  })
})
