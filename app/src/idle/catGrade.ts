import type { Company } from '@web/api/client'

export type CatGrade = NonNullable<Company['idle']>['cats'][number]['grade']

/**
 * 고양이 등급 (decisions.md 539번): 종마다 정해진 C·B·A·S. 등급과 그 효과는 서버가 준다. 여기는 뽑기 창에 적는 확률과 연출의 세기만 둔다.
 * 확률은 서버 `IdleEngine.GRADE_PERCENT`와 같다.
 */
export const CAT_GRADES: CatGrade[] = ['S', 'A', 'B', 'C']
export const CAT_GRADE_PERCENT: Record<CatGrade, number> = { S: 2, A: 10, B: 28, C: 60 }

/**
 * 고양이 인벤토리의 순서: 가진 고양이를 먼저 S·A·B·C 순으로, 그 뒤에 아직 없는 고양이를 S·A·B·C 순으로 둔다. 같은 등급 안에서는 서버가 준 순서를 지킨다.
 */
export function sortCats<T extends { level: number; grade: CatGrade }>(cats: readonly T[]): T[] {
  const rank = (c: T) => (c.level > 0 ? 0 : CAT_GRADES.length) + CAT_GRADES.indexOf(c.grade)
  return [...cats].sort((a, b) => rank(a) - rank(b))
}

/** 뽑기 창의 확률 한 줄: "S 2% · A 10% · B 28% · C 60%". */
export const CAT_ODDS = CAT_GRADES.map((g) => `${g} ${CAT_GRADE_PERCENT[g]}%`).join(' · ')

/**
 * 뽑기 연출의 세기: 등급이 높을수록 뜸이 길고 빛이 세다. 무기 뽑기의 D·B·A·S 등급 연출과 같다. 처음 얻은 고양이는 한 단계 위로 보여 준다.
 */
export function catRevealPlan(grade: CatGrade, isNew: boolean) {
  const plans = [
    { charge: 650, power: 1, color: '#76ccff', sound: 'D' as const },
    { charge: 1100, power: 2, color: '#f596ef', sound: 'B' as const },
    { charge: 1400, power: 2, color: '#ffb16e', sound: 'A' as const },
    { charge: 2100, power: 3, color: '#ffdd75', sound: 'S' as const },
  ]
  const at = ['C', 'B', 'A', 'S'].indexOf(grade)
  return plans[Math.min(plans.length - 1, Math.max(0, at) + (isNew ? 1 : 0))]
}

/** 빛나는 등급 (574번): A등급부터는 좋은 것을 뽑았다는 느낌이 들게 뽑기 연출이 빛난다. */
export function shinyCat(grade: CatGrade): boolean {
  return grade === 'A' || grade === 'S'
}
