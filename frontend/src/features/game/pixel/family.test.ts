import { describe, expect, it } from 'vitest'
import type { Game } from '../../../api/client'
import { carryBabies, familyFigures, lineUp, spanOf } from './family'
import type { Figure } from './vignettes'

const game = (married: boolean, ages: number[], left: number[] = [], sexes: string[] = []): Game =>
  ({
    sex: 'M',
    household: {
      married,
      children: ages.map((age, i) => ({ age, leftHome: left.includes(i), sex: sexes[i] ?? 'F' })),
    },
  }) as unknown as Game

describe('familyFigures', () => {
  it('혼자면 나만 anchor 자리에', () => {
    expect(familyFigures(game(false, []), 30, 36)).toEqual([
      { who: 'me', sex: 'M', stage: 'adult', x: 36 },
    ])
  })

  it('아이는 5세부터 소년·소녀 몸으로 서고, 4세까지는 업힌다 (#209, decisions.md 178번)', () => {
    const figures = familyFigures(game(true, [4, 5]), 33, 36)
    expect(figures.filter((f) => f.who === 'kid').map((f) => f.stage)).toEqual(['child'])
    expect(figures.find((f) => f.who === 'spouse')?.carrying).toMatchObject({ sex: 'F', look: 0 })
  })

  it('결혼하면 배우자가 옆에, 아이는 나이대로 몸이 다르고 모두 배경 안에 서로 닿지 않게 선다', () => {
    const figures = familyFigures(game(true, [3, 10, 16]), 42, 36)
    expect(figures.map((f) => f.who)).toEqual(['me', 'spouse', 'kid', 'kid'])
    expect(figures.map((f) => f.stage)).toEqual(['middle', 'middle', 'child', 'adult'])
    expectApart(figures)
  })

  it('배우자는 나와 반대 성별, 아이는 태어날 때 정해진 성별 (decisions.md 69번)', () => {
    const figures = familyFigures(game(true, [3, 10], [], ['M', 'F']), 42, 36)
    expect(figures.map((f) => [f.who, f.sex])).toEqual([
      ['me', 'M'],
      ['spouse', 'F'],
      ['kid', 'F'],
    ])
    expect(figures[1].carrying?.sex).toBe('M')
    const woman = { ...game(true, []), sex: 'F' } as Game
    expect(familyFigures(woman, 42, 36).map((f) => f.sex)).toEqual(['F', 'M'])
  })

  it('아이만 있어도(배우자 없이) 아이가 선다', () => {
    expect(familyFigures(game(false, [5]), 30, 10).map((f) => f.who)).toEqual(['me', 'kid'])
  })

  it('독립해 나간 아이는 집 사진에 없다 (decisions.md 68번)', () => {
    const figures = familyFigures(game(true, [27, 24], [0]), 58, 36)
    expect(figures.map((f) => [f.who, f.stage])).toEqual([
      ['me', 'middle'],
      ['spouse', 'middle'],
      ['kid', 'adult'],
    ])
  })

  it('아기는 배우자가 먼저 업고 다음은 내가 업는다. 업을 사람이 모자라면 아기도 선다 (decisions.md 178번)', () => {
    const figures = familyFigures(game(true, [1, 2, 3]), 33, 30)
    expect(figures.map((f) => [f.who, f.carrying?.look ?? null])).toEqual([
      ['me', 1],
      ['spouse', 0],
      ['kid', null],
    ])
    expect(figures[2]).toMatchObject({ stage: 'baby', look: 2 })
    expectApart(figures)
  })

  it('혼자면 내가 업는다. 아기 머리는 배경 안에 드는 쪽 어깨로', () => {
    expect(familyFigures(game(false, [2]), 30, 10)[0].carrying?.side).toBe('right')
    expect(familyFigures(game(false, [2]), 30, 48)[0].carrying?.side).toBe('left')
    expect(familyFigures(game(false, [2]), 30, 48)).toHaveLength(1)
  })

  it('아이의 생김새는 태어난 순서다. 독립한 아이를 빼도 순서가 밀리지 않는다', () => {
    const figures = familyFigures(game(false, [27, 12, 9], [0]), 58, 10)
    expect(figures.filter((f) => f.who === 'kid').map((f) => f.look)).toEqual([1, 2])
  })
})

describe('lineUp', () => {
  it('왼쪽부터 닿지 않게 세우고, 업은 사람 옆은 아기 머리만큼 더 띄운다. 넘치면 그리지 않는다', () => {
    const people = carryBabies([
      { who: 'me', sex: 'M', stage: 'adult' },
      { who: 'spouse', sex: 'F', stage: 'adult' },
      { who: 'kid', sex: 'F', stage: 'baby', look: 0 },
      { who: 'kid', sex: 'M', stage: 'child', look: 1 },
      { who: 'kid', sex: 'M', stage: 'child', look: 2 },
      { who: 'kid', sex: 'F', stage: 'child', look: 3 },
    ])
    const figures = lineUp(people)
    expect(figures.map((f) => f.x)).toEqual([2, 14, 31, 43])
    expect(figures[1].carrying?.side).toBe('right')
    expectApart(figures)
  })
})

function expectApart(figures: Figure[]) {
  const spans = figures.map((f) => spanOf(f).map((d) => f.x + d)).sort((a, b) => a[0] - b[0])
  for (const [l, r] of spans) {
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(63)
  }
  for (let i = 1; i < spans.length; i++) {
    expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1])
  }
}
