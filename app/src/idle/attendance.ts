import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { diamondText } from '@web/features/raising/gachaRules'

/** 출석 보상 (decisions.md 528번): 서버가 주는 출석판. */
export type Attendance = Company['attendance']
export type AttendanceCell = Attendance['board'][number]
export type AttendanceReward = NonNullable<Attendance['lastReward']>

/** 받은 보상을 한 줄로: "다이아 50개" · "돈 3.5a". 둘 다면 가운뎃점으로 잇는다. */
export function rewardText(reward: { diamonds: number; money?: number | null }): string {
  const parts: string[] = []
  if (reward.diamonds > 0) parts.push(`다이아 ${diamondText(reward.diamonds)}개`)
  if ((reward.money ?? 0) > 0) parts.push(`돈 ${money(reward.money ?? 0)}`)
  return parts.join(' · ')
}

/** 칸에 적는 양: 다이아 칸은 수, 돈 칸은 지금 받으면 들어올 돈. */
export function cellAmount(cell: AttendanceCell): string {
  return cell.diamonds > 0 ? diamondText(cell.diamonds) : money(cell.money ?? 0)
}

/** 칸의 상태: 받은 칸(done), 오늘 받을 칸(today), 아직 먼 칸(later). 오늘 이미 받았으면 오늘 칸도 done이다. */
export function cellState(
  attendance: Attendance,
  cell: AttendanceCell,
): 'done' | 'today' | 'later' {
  if (cell.claimed) return 'done'
  return attendance.claimable && cell.day === attendance.today ? 'today' : 'later'
}

/**
 * 출석판을 스스로 띄울 것인가: 오늘 보상을 아직 안 받았고, 이 화면에서 그 칸을 닫은 적이 없을 때. 닫은 뒤에는 위쪽 단추로 다시 연다. 다음 날이 되면(오늘 칸이
 * 바뀌면) 다시 뜬다.
 */
export function shouldAutoOpen(attendance: Attendance, dismissedDay: number | null): boolean {
  return attendance.claimable && attendance.today !== dismissedDay
}
