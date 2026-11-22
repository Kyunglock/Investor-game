import { describe, expect, it } from 'vitest'
import { cardSuspense } from '../mental/TenReveal'
import { shinyWeapon } from '../mental/weaponRevealPlan'
import {
  bestDraw,
  CAT_GRADE_PERCENT,
  CAT_ODDS,
  catRevealPlan,
  shinyCat,
  sortCats,
} from './catGrade'

describe('고양이 등급 (539번)', () => {
  it('뽑기 확률은 합쳐 100%이고 S가 가장 드물다', () => {
    expect(Object.values(CAT_GRADE_PERCENT).reduce((a, b) => a + b, 0)).toBe(100)
    expect(CAT_ODDS).toBe('S 1% · A 10% · B 28% · C 61%')
  })

  it('A등급부터 뽑기 연출이 빛난다 (574번)', () => {
    expect((['C', 'B', 'A', 'S'] as const).map(shinyCat)).toEqual([false, false, true, true])
    expect((['F', 'E', 'D', 'C', 'B'] as const).some(shinyWeapon)).toBe(false)
    expect((['A', 'S', 'SS', 'SSS', 'SR', 'UR', 'LR'] as const).every(shinyWeapon)).toBe(true)
  })

  it('좋은 장일수록 열리기 전의 뜸이 길다: A등급 0.5초, S등급 이상 1초 (576번)', () => {
    expect(cardSuspense({ shiny: false, jackpot: false })).toBeLessThan(300)
    expect(cardSuspense({ shiny: true, jackpot: false })).toBe(500)
    expect(cardSuspense({ shiny: true, jackpot: true })).toBe(1000)
  })

  it('등급이 높을수록 뽑기 연출이 길고 세다', () => {
    const charges = (['C', 'B', 'A', 'S'] as const).map((g) => catRevealPlan(g, false).charge)
    expect(charges).toEqual([...charges].sort((a, b) => a - b))
    expect(catRevealPlan('S', false)).toMatchObject({ power: 3, sound: 'S' })
    expect(catRevealPlan('C', false)).toMatchObject({ power: 1, sound: 'D' })
  })

  it('처음 얻은 고양이는 뜸·빛·소리가 한 단계 위다', () => {
    const { color: _, ...strength } = catRevealPlan('B', false)
    expect(catRevealPlan('C', true)).toMatchObject(strength)
    expect(catRevealPlan('S', true)).toEqual(catRevealPlan('S', false))
  })

  it('카드의 색은 등급으로만 정한다: 처음 얻었어도 윗등급 색을 쓰지 않는다 (#917)', () => {
    const colors = (['C', 'B', 'A', 'S'] as const).map((g) => catRevealPlan(g, false).color)
    expect(new Set(colors).size).toBe(4)
    expect((['C', 'B', 'A', 'S'] as const).map((g) => catRevealPlan(g, true).color)).toEqual(colors)
  })

  it('10연차의 알림과 팀 편성은 마지막 장이 아니라 등급이 가장 높은 고양이를 가리킨다 (#911)', () => {
    const draw = (code: string, grade: 'C' | 'B' | 'A' | 'S', isNew = false) => ({
      code,
      grade,
      isNew,
    })
    expect(
      bestDraw([draw('sky', 'C', true), draw('star', 'S', true), draw('petrol', 'C', true)]),
    ).toEqual({ code: 'star', isNew: true })
    // 같은 등급이면 이번에 처음 얻은 고양이가 먼저다. 같은 고양이가 또 나온 장이 뒤에 있어도 처음 얻은 것으로 친다.
    expect(
      bestDraw([
        draw('cloud', 'B'),
        draw('peach', 'B', true),
        draw('peach', 'B'),
        draw('sky', 'C'),
      ]),
    ).toEqual({ code: 'peach', isNew: true })
    // 그래도 같으면 먼저 나온 고양이다.
    expect(bestDraw([draw('sky', 'C'), draw('mint', 'C')])).toEqual({ code: 'sky', isNew: false })
    expect(bestDraw([])).toBeNull()
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
