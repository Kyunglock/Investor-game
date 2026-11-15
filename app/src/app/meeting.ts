import type { Company } from '@web/api/client'

/**
 * 종목회의 칸의 상태 (#803). continue: 정하지 않은 회의가 열려 있다. open: 기회가 있어 새로 열 수 있다. wait: 기회가 없어 기다린다. nodesk: 돈을
 * 굴리는 자리에 아무도 없어 열 수 없다.
 */
export type MeetingState = 'continue' | 'open' | 'wait' | 'nodesk'

type MeetingCompany = Pick<Company, 'invest' | 'meetings' | 'employees' | 'desks'>

/** 돈을 굴리는 자리(trades)에 앉은 사람이 있는가. 없으면 서버가 회의를 열어 주지 않는다. */
export function hasTrader(company: Pick<Company, 'employees' | 'desks'>): boolean {
  const trading = new Set(company.desks.filter((d) => d.trades).map((d) => d.code))
  return company.employees.some((e) => e.desk != null && trading.has(e.desk))
}

/** 열어 두고 아직 정하지 않은 회의가 있는가. 정한 회의는 결과로 남아 있을 뿐이다. */
export function meetingPending(company: Pick<Company, 'invest'>): boolean {
  const invest = company.invest
  return Boolean(invest?.convened && invest.outcome == null)
}

export function meetingState(company: MeetingCompany): MeetingState {
  if (meetingPending(company)) return 'continue'
  if (!hasTrader(company)) return 'nodesk'
  return company.meetings.chances > 0 ? 'open' : 'wait'
}

/** 탭·메뉴에 표를 다는가: 회의를 열거나 이어 갈 수 있고, 돈을 굴리는 자리에 사람이 있을 때. */
export function meetingReady(company: MeetingCompany): boolean {
  if (!hasTrader(company)) return false
  return meetingPending(company) || company.meetings.chances > 0
}

/** 다음 기회까지 남은 초: 응답을 받은 때의 값에서 그 뒤로 흐른 시간을 뺀다. 0 아래로 내려가지 않는다. */
export function secondsLeft(nextSeconds: number, elapsedMs: number): number {
  return Math.max(0, Math.ceil(nextSeconds - Math.max(0, elapsedMs) / 1000))
}

/** 남은 시간을 m:ss로 (한 시간이 넘으면 h:mm:ss). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const two = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}
