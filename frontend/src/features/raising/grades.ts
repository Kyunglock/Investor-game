import type { Grade } from '../../api/client'

/** 등급 사다리 15단계, 낮은 것부터 (증권사 육성 설계 2.1절). */
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

/**
 * 사다리 색 (11.3절): F~SSS는 흰색 계열, X·XX·XXX는 파란색, Z·ZZ·ZZZ는 금색. X와 Z가 SSS 위라는 것이 눈으로 보인다. 직원 차림새의 빛과
 * 같은 색이다 (8.2절).
 */
export function ladderTone(grade: Grade): string {
  if (grade.startsWith('Z')) {
    return 'bg-gold text-white'
  }
  if (grade.startsWith('X')) {
    return 'bg-down text-white'
  }
  return 'bg-card text-ink border border-line'
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
