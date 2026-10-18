/**
 * 능력치 등급. 점수(0~100)의 띠라 점수가 바뀌면 등급도 따라 바뀐다. 서버 common.StatGrade와 같은 띠를 쓴다 (decisions.md 24번).
 * 태어날 때의 등급 확률(SSS 1%, SS 3%, S 5%, A 10%, B 16%, C 25%, D 20%, E 12%, F 8%)은 서버 설정에 있다.
 */

export type Grade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** 등급과 그 등급의 가장 낮은 점수. 높은 등급부터. */
export const GRADE_BANDS: readonly [Grade, number][] = [
  ['SSS', 90],
  ['SS', 80],
  ['S', 70],
  ['A', 60],
  ['B', 50],
  ['C', 40],
  ['D', 30],
  ['E', 20],
  ['F', 0],
]

export function gradeOf(score: number): Grade {
  for (const [grade, min] of GRADE_BANDS) {
    if (score >= min) {
      return grade
    }
  }
  return 'F'
}

/** 등급 배지 색. S 이상은 와인색, A·B는 청록, C·D는 먹색, E·F는 흐리게. */
export function gradeTone(grade: Grade): string {
  switch (grade) {
    case 'SSS':
    case 'SS':
    case 'S':
      return 'bg-wine text-white'
    case 'A':
    case 'B':
      return 'bg-teal text-white'
    case 'C':
    case 'D':
      return 'bg-ink text-white'
    default:
      return 'bg-line text-muted'
  }
}
