import type { Company } from '@web/api/client'
import { diamondText } from '@web/features/raising/gachaRules'

/** 출석 보상 (decisions.md 528·564번): 서버가 주는 출석판. */
export type Attendance = Company['attendance']
export type AttendanceReward = NonNullable<Attendance['lastReward']>

/** 지금 출석 보상을 받을 것인가 (564번): 오늘 것을 아직 안 받았고, 다른 창이 가리고 있지 않을 때. */
export function shouldClaim(attendance: Attendance, wait: boolean): boolean {
  return attendance.claimable && !wait
}

/** 받았다는 알림 한 줄: "출석 3일차 · 다이아 100개 받았어요". 출석 보상은 다이아뿐이다 (564번). */
export function receivedText(reward: { day: number; diamonds: number }): string {
  return `출석 ${reward.day}일차 · 다이아 ${diamondText(reward.diamonds)}개 받았어요`
}
