import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { drawBadge, freeCopies, gearCells, holdersOf, mergeable, mergeBlock } from './armory'

const KIND = { F: 'pistol', E: 'pistol', D: 'revolver', S: 'rifle', LR: 'rifle' } as const
type Grade = keyof typeof KIND

/** 가진 무기 [등급, 수], 사장냥이 든 등급, 고양이가 든 등급. */
const company = (
  owned: [Grade, number][],
  boss: Grade,
  cats: Record<string, Grade | null> = {},
  mergeCount = 2,
) =>
  ({
    diamonds: { amount: 250, draw: 100, tenDraw: 1000, tenCount: 11, hire: 100 },
    armory: { mergeCount, lastDraw: null, lastDraws: [] },
    weapons: owned.map(([grade, count]) => ({
      kind: KIND[grade],
      name: KIND[grade],
      grade,
      gradeName: grade,
      count,
      equipped: grade === boss,
    })),
    idle: {
      cats: Object.entries(cats).map(([code, grade]) => ({
        code,
        name: `${code}냥`,
        weapon: grade ? { kind: KIND[grade], grade } : null,
      })),
    },
  }) as unknown as Company

const weapon = (c: Company, grade: Grade) => {
  const found = c.weapons?.find((w) => w.grade === grade)
  if (!found) throw new Error(`없는 무기: ${grade}`)
  return found
}

describe('장비 목록 (530번)', () => {
  it('든 이는 사장냥이 먼저고, 아무도 들지 않은 수는 가진 수에서 든 이를 뺀다', () => {
    const c = company([['F', 4]], 'F', { sky: 'F', mint: null })
    expect(holdersOf(c, weapon(c, 'F')).map((h) => h.name)).toEqual(['사장냥', 'sky냥'])
    expect(freeCopies(c, weapon(c, 'F'))).toBe(2)
  })

  it('아무도 들지 않은 것이 합칠 수만큼 있어야 합친다: 든 것은 합치기에 쓰지 않는다', () => {
    const c = company(
      [
        ['F', 3],
        ['E', 3],
        ['D', 2],
        ['LR', 5],
      ],
      'F',
      { sky: 'E', mint: 'E' },
    )
    expect(mergeBlock(c, weapon(c, 'F'))).toBeNull()
    // 셋 가운데 둘을 고양이가 들었다.
    expect(mergeBlock(c, weapon(c, 'E'))).toBe('short')
    expect(mergeBlock(c, weapon(c, 'D'))).toBeNull()
    // 가장 높은 등급은 몇 개여도 못 합친다.
    expect(mergeBlock(c, weapon(c, 'LR'))).toBe('top')
    expect(mergeable(c).map((w) => w.grade)).toEqual(['D', 'F'])
  })

  it('무기고가 없는 옛 회사는 합치지 못한다', () => {
    const c = { ...company([['F', 4]], 'F'), armory: undefined } as Company
    expect(mergeBlock(c, weapon(c, 'F'))).toBe('short')
    expect(mergeable(c)).toEqual([])
  })

  it('든 것은 한 칸에 하나씩, 남은 것은 합칠 수만큼까지 나눠 보이고 나머지는 마지막 칸에 묶는다', () => {
    const c = company(
      [
        ['F', 6],
        ['S', 1],
        ['E', 1],
      ],
      'F',
      { sky: 'F', mint: 'S' },
    )
    const cells = gearCells(c).map((cell) => [
      cell.weapon.grade,
      cell.holder?.name ?? null,
      cell.stack,
    ])
    expect(cells).toEqual([
      // 등급 높은 순.
      ['S', 'mint냥', 1],
      ['E', null, 1],
      ['F', '사장냥', 1],
      ['F', 'sky냥', 1],
      ['F', null, 1],
      ['F', null, 3],
    ])
    // 칸의 수를 더하면 가진 수다.
    expect(gearCells(c).reduce((sum, cell) => sum + cell.stack, 0)).toBe(8)
  })

  it('셋을 합치는 회사면 남은 것을 세 칸까지 나눈다', () => {
    const c = company([['F', 6]], 'F', {}, 3)
    expect(gearCells(c).map((cell) => cell.stack)).toEqual([1, 1, 1, 3])
  })

  it('무기 전에 차린 회사는 사장냥이 든 권총 한 칸이다', () => {
    const c = { ...company([], 'F'), weapons: [] } as Company
    expect(gearCells(c).map((cell) => [cell.weapon.kind, cell.holder?.name])).toEqual([
      ['pistol', '사장냥'],
    ])
  })
})

describe('무기 뽑기 배지 (526번)', () => {
  it('가진 다이아로 뽑을 수 있는 횟수다', () => {
    const c = company([['F', 1]], 'F')
    expect(drawBadge(c)).toBe('2')
    expect(drawBadge({ ...c, diamonds: { ...c.diamonds, amount: 99 } })).toBeNull()
    expect(drawBadge({ ...c, diamonds: { ...c.diamonds, amount: 100_000 } })).toBe('99+')
    expect(drawBadge({ ...c, armory: undefined })).toBeNull()
  })
})
