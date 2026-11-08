import type { Grade } from '../../api/client'

/** 회사 등급 사다리 15단계, 낮은 것부터 (증권사 육성 설계 2.1절). 직원 등급은 그 위로 XS·XSS·GOD가 더 있다(EMPLOYEE_LADDER, 289번). */
export const LADDER: readonly Grade[] = [
  'F',
  'E',
  'D',
  'C',
  'B',
  'A',
  'S',
  'SS',
  'SSS',
  'X',
  'XX',
  'XXX',
  'Z',
  'ZZ',
  'ZZZ',
]

/** 직원 등급 사다리 18단계 (decisions.md 289번): 회사 사다리 위로 XS·XSS·GOD. */
export const EMPLOYEE_LADDER: readonly Grade[] = [...LADDER, 'XS', 'XSS', 'GOD']

/**
 * 결산서의 팀 등급 (decisions.md 397번): 팀장의 종합 등급과, 팀장을 뺀 팀원의 종합 등급을 높은 것부터. 지금 직원 목록에서 찾으므로 그새 떠난 사람은
 * 빠진다(팀장이 떠났으면 leader가 없다).
 */
export function teamGrades(
  employees: readonly { id: number; overallGrade: Grade }[],
  leaderId: number,
  memberIds: readonly number[],
): { leader?: Grade; members: Grade[] } {
  const gradeOf = (id: number) => employees.find((e) => e.id === id)?.overallGrade
  const members = memberIds
    .filter((id) => id !== leaderId)
    .map(gradeOf)
    .filter((g): g is Grade => g !== undefined)
    .sort((a, b) => EMPLOYEE_LADDER.indexOf(b) - EMPLOYEE_LADDER.indexOf(a))
  return { leader: gradeOf(leaderId), members }
}

/** 화면에 숫자를 보이지 않으므로, 맞대결 막대의 처음 몫은 등급 띠의 가운데로 잡는다. */
const BAND_MIDDLE: Partial<Record<Grade, number>> = {
  F: 10,
  E: 25,
  D: 35,
  C: 45,
  B: 55,
  A: 65,
  S: 75,
  SS: 85,
  SSS: 95,
}

export function shareOf(grade: Grade | undefined): number {
  return BAND_MIDDLE[grade ?? 'C'] ?? 95
}

export const STAT_ORDER = ['insight', 'patience', 'courage', 'conviction', 'luck'] as const

export const STAT_NAMES: Record<string, string> = {
  insight: '안목',
  patience: '인내심',
  courage: '용기',
  conviction: '줏대',
  luck: '운',
}
