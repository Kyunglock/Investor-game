import { describe, expect, it } from 'vitest'
import { CAT_GRADE_PERCENT, CAT_ODDS, catRevealPlan, sortCats } from './catGrade'

describe('고양이 등급 (539번)', () => {
  it('뽑기 확률은 합쳐 100%이고 S가 가장 드물다', () => {
    expect(Object.values(CAT_GRADE_PERCENT).reduce((a, b) => a + b, 0)).toBe(100)
    expect(CAT_ODDS).toBe('S 2% · A 10% · B 28% · C 60%')
  })

  it('등급이 높을수록 뽑기 연출이 길고 세다', () => {
    const charges = (['C', 'B', 'A', 'S'] as const).map((g) => catRevealPlan(g, false).charge)
    expect(charges).toEqual([...charges].sort((a, b) => a - b))
    expect(catRevealPlan('S', false)).toMatchObject({ power: 3, sound: 'S' })
    expect(catRevealPlan('C', false)).toMatchObject({ power: 1, sound: 'D' })
  })

  it('처음 얻은 고양이는 한 단계 위의 연출로 나온다', () => {
    expect(catRevealPlan('C', true)).toEqual(catRevealPlan('B', false))
    expect(catRevealPlan('S', true)).toEqual(catRevealPlan('S', false))
  })

  it('인벤토리는 가진 고양이를 등급순(S→C)으로 먼저, 없는 고양이를 등급순으로 뒤에 둔다', () => {
    const cats = [
      { code: 'a', level: 0, grade: 'S' },
      { code: 'b', level: 3, grade: 'C' },
      { code: 'c', level: 1, grade: 'A' },
      { code: 'd', level: 0, grade: 'C' },
      { code: 'e', level: 2, grade: 'C' },
      { code: 'f', level: 0, grade: 'B' },
    ] as const
    expect(sortCats(cats).map((c) => c.code)).toEqual(['c', 'b', 'e', 'a', 'f', 'd'])
  })
})
