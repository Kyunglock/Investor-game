import { describe, expect, it } from 'vitest'
import {
  advanceDay,
  ageAt,
  clockLimit,
  REPORT_EVERY_DAYS,
  secondsPerYear,
  shouldReport,
  totalDays,
} from './clock'

const DAYS_PER_YEAR = 360

describe('secondsPerYear', () => {
  it('성장기는 빨리, 성인기는 천천히 흐른다', () => {
    expect(secondsPerYear('CHILDHOOD')).toBeLessThan(secondsPerYear('SAVING'))
    expect(secondsPerYear('SAVING')).toBe(secondsPerYear('INVESTING'))
  })

  it('한 판은 대략 10분이다', () => {
    const childhoodYears = 24 - 1
    const adultYears = 65 - 24
    const seconds =
      childhoodYears * secondsPerYear('CHILDHOOD') + adultYears * secondsPerYear('INVESTING')
    expect(seconds).toBeGreaterThan(9 * 60)
    expect(seconds).toBeLessThan(11 * 60)
  })
})

describe('advanceDay', () => {
  it('1배속으로 1년치 시간이 흐르면 360일이 지난다', () => {
    expect(advanceDay(0, 12_000, 1, DAYS_PER_YEAR, 23_040, 12)).toBeCloseTo(360)
  })

  it('2배속이면 두 배로 흐른다', () => {
    expect(advanceDay(0, 12_000, 2, DAYS_PER_YEAR, 23_040, 12)).toBeCloseTo(720)
  })

  it('한계를 넘지 않는다', () => {
    expect(advanceDay(23_030, 60_000, 2, DAYS_PER_YEAR, 23_040, 12)).toBe(23_040)
  })
})

describe('clockLimit', () => {
  it('다음 이벤트가 있으면 그 시각에서 멈춘다', () => {
    expect(clockLimit(23_040, 1_800)).toBe(1_800)
  })

  it('다음 이벤트가 없으면 판의 끝까지 간다', () => {
    expect(clockLimit(23_040, null)).toBe(23_040)
    expect(clockLimit(23_040, undefined)).toBe(23_040)
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
    expect(ageAt(1, 0, DAYS_PER_YEAR)).toEqual({ years: 1, months: 0 })
    expect(ageAt(1, 359, DAYS_PER_YEAR)).toEqual({ years: 1, months: 11 })
    expect(ageAt(1, 1_800, DAYS_PER_YEAR)).toEqual({ years: 6, months: 0 })
  })
})

describe('totalDays', () => {
  it('1세에서 65세까지는 23,040일이다', () => {
    expect(totalDays(1, 65, DAYS_PER_YEAR)).toBe(23_040)
  })
})
