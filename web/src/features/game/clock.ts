/**
 * 게임 시계는 클라이언트가 구동하고, 서버에는 경과한 게임 일수만 보고한다 (architecture.md 4절).
 * 수치는 "일단 만들어 보고 판단"하기로 한 초기값이다 (decisions.md 2번).
 */

/** 한 판 10분에 40년(25→65세)이면 1년이 15초다. */
export const SECONDS_PER_YEAR = 15

/** 서버의 한 번에 건너뛸 수 있는 상한(360일)보다 충분히 작게 보고한다. */
export const REPORT_EVERY_DAYS = 90

export const SPEEDS = [1, 2] as const
export type Speed = (typeof SPEEDS)[number]

export function totalDays(startAge: number, endAge: number, daysPerYear: number): number {
  return (endAge - startAge) * daysPerYear
}

/** 경과 시간만큼 게임 일수를 앞으로 보낸다. 마지막 날을 넘지 않는다. */
export function advanceDay(
  day: number,
  elapsedMs: number,
  speed: Speed,
  daysPerYear: number,
  lastDay: number,
): number {
  const daysPerMs = daysPerYear / (SECONDS_PER_YEAR * 1000)
  return Math.min(lastDay, day + elapsedMs * daysPerMs * speed)
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
