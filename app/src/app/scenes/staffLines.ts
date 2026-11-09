import type { Grade } from '@web/api/client'
import { EMPLOYEE_LADDER } from '@web/features/raising/grades'

/** 말풍선 한마디를 고르는 데 쓰는 직원의 몫. */
export type Speaker = {
  id: number
  overallGrade: Grade
  /** 사기 −2(바닥) ~ 2(의욕 넘침), decisions.md 270번 */
  morale: number
  deskYears: number
  leader: boolean
}

const PLAIN = [
  '다들 힘내 봐요!',
  '차트 보는 중이에요',
  '좋은 종목 찾아올게요',
  '커피 한 잔 하고 갈까요?',
]

/**
 * 사무실 팀장의 말풍선 (decisions.md 412번): 사기·같은 자리 햇수·등급으로 고른다. 같은 직원은 늘 같은 말을 한다(번호로 고르니 다시 그려도 그대로).
 */
export function deskLine(e: Speaker): string {
  if (e.morale <= -2) return '요즘 손이 자꾸 떨려요…'
  if (e.morale < 0) return '분위기 좀 띄워 주세요'
  if (e.morale >= 2) return '오늘 촉이 아주 좋아요!'
  if (e.leader && EMPLOYEE_LADDER.indexOf(e.overallGrade) >= EMPLOYEE_LADDER.indexOf('A')) {
    return '이번 분기 제가 맡을게요!'
  }
  if (e.deskYears >= 3) return '이 자리는 눈 감고도 해요'
  if (e.morale >= 1) return '팀 분위기 최고예요!'
  return PLAIN[Math.abs(e.id) % PLAIN.length]
}

/** 휴게실에서 말하는 한 사람: 등급이 가장 높은 사람(같으면 번호가 작은 사람). 아무도 없으면 null. */
export function loungeSpeaker<T extends Speaker>(resting: readonly T[]): T | null {
  return resting.reduce<T | null>((best, e) => {
    if (!best) return e
    const a = EMPLOYEE_LADDER.indexOf(e.overallGrade)
    const b = EMPLOYEE_LADDER.indexOf(best.overallGrade)
    return a > b || (a === b && e.id < best.id) ? e : best
  }, null)
}

export const LOUNGE_LINE = '저 일하고 싶어요…'

/** 팀 분위기 하트 (0~5): 앉은 사람 사기의 평균을 −2~2에서 1~5로 옮긴다. 아무도 없으면 0. */
export function moodHearts(morales: readonly number[]): number {
  if (morales.length === 0) return 0
  const avg = morales.reduce((a, b) => a + b, 0) / morales.length
  return Math.min(5, Math.max(1, Math.round(avg + 3)))
}

/** 머리띠의 팀 분위기 한마디: 일하는 사람 모두의 사기 평균으로. */
export function moodPhrase(morales: readonly number[]): string {
  if (morales.length === 0) return '사무실이 조용해요'
  const avg = morales.reduce((a, b) => a + b, 0) / morales.length
  if (avg >= 1) return '팀 분위기 최고'
  if (avg > 0.25) return '팀 분위기 좋음'
  if (avg >= -0.25) return '팀 분위기 무난'
  if (avg > -1) return '팀 분위기 처짐'
  return '팀 분위기 바닥'
}
