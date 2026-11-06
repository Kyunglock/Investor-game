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
 * 화면에 보이는 등급 글자 (decisions.md 286번). 코드(X~ZZZ)는 서버·저장에 그대로 두고 글자만 바꾼다: SSS 위는 EX·EX+·EX++,
 * 그 위는 별 하나·둘·셋. ZZZ가 "쿨쿨", XXX가 성인물로 읽히던 것을 피한다. 백엔드 CompanyEngine.shown과 같다.
 */
export const GRADE_LABEL: Record<Grade, string> = {
  F: 'F',
  E: 'E',
  D: 'D',
  C: 'C',
  B: 'B',
  A: 'A',
  S: 'S',
  SS: 'SS',
  SSS: 'SSS',
  X: 'EX',
  XX: 'EX+',
  XXX: 'EX++',
  Z: '★',
  ZZ: '★★',
  ZZZ: '★★★',
}

export function gradeLabel(grade: Grade | string): string {
  return GRADE_LABEL[grade as Grade] ?? grade
}

/**
 * 등급 표시의 층 (286번). 층마다 배지 모양이 다르고, 층 안에서는 단계(1~3)가 오를수록 진해진다.
 * low F·E·D 흐린 회색 · mid C·B·A 먹색 테두리 · high S·SS·SSS 와인색 · ex EX~EX++ 파란 바탕 · star ★~★★★ 금빛.
 * 색은 차림새의 빛(8.2절: EX 파란빛, ★ 금빛)과 맞춘다.
 */
export type GradeTier = 'low' | 'mid' | 'high' | 'ex' | 'star'

const TIERS: readonly GradeTier[] = ['low', 'mid', 'high', 'ex', 'star']

export function gradeTier(grade: Grade): { tier: GradeTier; step: 1 | 2 | 3 } {
  const at = Math.max(0, LADDER.indexOf(grade))
  // F·E·D 세 칸이 맨 아래 층이고, 그 위로 세 칸씩 한 층이다.
  return { tier: TIERS[Math.floor(at / 3)], step: ((at % 3) + 1) as 1 | 2 | 3 }
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
