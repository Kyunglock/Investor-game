/**
 * 게임 시계는 클라이언트가 구동하고, 서버에는 경과한 게임 일수만 보고한다 (architecture.md 4절).
 * 수치는 "일단 만들어 보고 판단"하기로 한 초기값이다 (decisions.md 2번).
 */

import type { Phase } from '../../api/client'

/**
 * 성장기는 이벤트가 적어서 빨리 흐르고, 성인기에 시간을 더 쓴다 (decisions.md).
 * 성장기 약 23년 × 4초 + 성인기 약 41년 × 12초 ≈ 9분 40초로 한 판 10분에 맞춘다.
 */
const SECONDS_PER_YEAR_CHILDHOOD = 4
const SECONDS_PER_YEAR_ADULT = 12

export function secondsPerYear(phase: Phase): number {
  return phase === 'CHILDHOOD' ? SECONDS_PER_YEAR_CHILDHOOD : SECONDS_PER_YEAR_ADULT
}

/** 이벤트가 없어도 월급이 화면에 반영되도록 주기적으로 보고한다. 서버의 건너뛰기 상한(360일)보다 충분히 작다. */
export const REPORT_EVERY_DAYS = 90

export const SPEEDS = [1, 2] as const
export type Speed = (typeof SPEEDS)[number]

export function totalDays(startAge: number, endAge: number, daysPerYear: number): number {
  return (endAge - startAge) * daysPerYear
}

/** 시계가 갈 수 있는 끝. 다음 이벤트 시각을 넘지 않아야 서버가 그 시각에 이벤트를 띄운다. */
export function clockLimit(lastDay: number, nextEventDay: number | null | undefined): number {
  return nextEventDay == null ? lastDay : Math.min(lastDay, nextEventDay)
}

/** 경과 시간만큼 게임 일수를 앞으로 보낸다. limit을 넘지 않는다. */
export function advanceDay(
  day: number,
  elapsedMs: number,
  speed: Speed,
  daysPerYear: number,
  limit: number,
  yearSeconds: number,
): number {
  const daysPerMs = daysPerYear / (yearSeconds * 1000)
  return Math.min(limit, day + elapsedMs * daysPerMs * speed)
}

export function shouldReport(day: number, reportedDay: number): boolean {
  return Math.floor(day) - reportedDay >= REPORT_EVERY_DAYS
}

export function ageAt(
  startAge: number,
  day: number,
  daysPerYear: number,
): { years: number; months: number } {
  const whole = Math.floor(day)
  const daysPerMonth = daysPerYear / 12
  return {
    years: startAge + Math.floor(whole / daysPerYear),
    months: Math.floor((whole % daysPerYear) / daysPerMonth),
  }
}
