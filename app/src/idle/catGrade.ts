import type { Company } from '@web/api/client'

export type CatGrade = NonNullable<Company['idle']>['cats'][number]['grade']

/**
 * 고양이 등급 (decisions.md 539번): 종마다 정해진 C·B·A·S·SS. 등급과 그 효과는 서버가 준다. 여기는 뽑기 창에 적는 확률과 연출의 세기만 둔다.
 * 확률은 서버 `IdleEngine.GRADE_PER_THOUSAND`와 같다.
 */
export const CAT_GRADES: CatGrade[] = ['SS', 'S', 'A', 'B', 'C']
// 651번: S 2% → 1%, 줄어든 몫은 C(59.8% → 60.8%)로.
export const CAT_GRADE_PERCENT: Record<CatGrade, number> = { SS: 0.2, S: 1, A: 10, B: 28, C: 60.8 }

/**
 * 고양이 인벤토리의 순서: 가진 고양이를 먼저 SS·S·A·B·C 순으로, 그 뒤에 아직 없는 고양이를 SS·S·A·B·C 순으로 둔다. 같은 등급 안에서는 서버가 준 순서를 지킨다.
 */
export function sortCats<T extends { level: number; grade: CatGrade }>(cats: readonly T[]): T[] {
  const rank = (c: T) => (c.level > 0 ? 0 : CAT_GRADES.length) + CAT_GRADES.indexOf(c.grade)
  return [...cats].sort((a, b) => rank(a) - rank(b))
}

/** 뽑기 창의 확률 한 줄: "SS 0.2% · S 1% · A 10% · B 28% · C 60.8%". */
export const CAT_ODDS = CAT_GRADES.map((g) => `${g} ${CAT_GRADE_PERCENT[g]}%`).join(' · ')

/**
 * 뽑기 연출의 세기: 등급이 높을수록 뜸이 길고 빛이 세다. 무기 뽑기의 D·B·A·S 등급 연출과 같다. 처음 얻은 고양이는 뜸·빛·소리를 한 단계 위로
 * 보여 준다. 색은 등급의 색 그대로다 (#917): 처음 얻었다고 윗등급 색을 쓰면 카드에 적힌 등급과 테두리 색이 어긋난다.
 */
export function catRevealPlan(grade: CatGrade, isNew: boolean) {
  const plans = [
    { charge: 650, power: 1, color: '#76ccff', sound: 'D' as const },
    { charge: 1100, power: 2, color: '#f596ef', sound: 'B' as const },
    { charge: 1400, power: 2, color: '#ffb16e', sound: 'A' as const },
    { charge: 2100, power: 3, color: '#ffdd75', sound: 'S' as const },
  ]
  if (grade === 'SS') return { charge: 0, power: 3, color: '#c4fffa', sound: 'SS' as const }
  const at = ['C', 'B', 'A', 'S'].indexOf(grade)
  const own = plans[Math.max(0, at)]
  return {
    ...plans[Math.min(plans.length - 1, Math.max(0, at) + (isNew ? 1 : 0))],
    color: own.color,
  }
}

/**
 * 10연차에서 알림과 '팀 편성하기'가 가리킬 한 마리 (#911): 등급이 가장 높은 고양이. 같은 등급이면 이번에 처음 얻은 고양이, 그래도 같으면 먼저
 * 나온 고양이다. isNew는 그 고양이가 이번 뽑기에서 처음 나왔는가다(같은 고양이가 또 나온 장은 isNew가 아니다).
 */
export function bestDraw<T extends { code: string; grade: CatGrade; isNew: boolean }>(
  draws: readonly T[],
): { code: T['code']; isNew: boolean } | null {
  const fresh = (d: T) => draws.some((other) => other.code === d.code && other.isNew)
  const rank = (d: T) => CAT_GRADES.indexOf(d.grade) * 2 + (fresh(d) ? 0 : 1)
  const best = draws.reduce<T | null>((a, b) => (a && rank(a) <= rank(b) ? a : b), null)
  return best && { code: best.code, isNew: fresh(best) }
}

/**
 * 넘길 수 없는 뽑기 (693번): S등급 이상의 고양이를 처음 얻으면 축하 연출이 3초(`REVEAL_HOLD_MS`) 나오고, 그동안은 넘기거나 닫을 수 없다.
 */
export function holdsReveal(grade: CatGrade, isNew: boolean): boolean {
  return isNew && (grade === 'S' || grade === 'SS')
}

/** 빛나는 등급 (574번): A등급부터는 좋은 것을 뽑았다는 느낌이 들게 뽑기 연출이 빛난다. */
export function shinyCat(grade: CatGrade): boolean {
  return grade === 'A' || grade === 'S' || grade === 'SS'
}
