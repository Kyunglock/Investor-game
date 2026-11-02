import { describe, expect, it } from 'vitest'
import { ADORNMENTS } from './adornments'
import { AGE_STAGES, bodyFor } from './bodies'
import { MARKS } from './marks'
import { EYELIDS, MOODS } from './moods'
import { CHARACTER_PALETTE } from './palette'
import { CHAR_HEIGHT, CHAR_WIDTH, compose, type Layer, toRects, toRuns } from './sprite'

const SEXES = ['M', 'F'] as const
const adult = bodyFor('M', 'adult')

describe('몸통 (decisions.md 142번)', () => {
  it('성별·나이마다 40행 32열이고 모든 글자가 캐릭터 팔레트에 있다', () => {
    for (const sex of SEXES) {
      for (const stage of AGE_STAGES) {
        const body = bodyFor(sex, stage)
        expect(body.map, `${sex} ${stage}`).toHaveLength(CHAR_HEIGHT)
        for (const row of body.map) {
          expect(row).toHaveLength(CHAR_WIDTH)
          for (const ch of row) {
            expect(ch === '.' || ch in CHARACTER_PALETTE, `${sex} ${stage} ${ch}`).toBe(true)
          }
        }
      }
    }
  })

  it('모든 몸통은 같은 얼굴 좌표를 쓴다: 눈은 ht+12~14 줄의 10~12·19~21열, 반짝임은 ht+13 줄', () => {
    for (const sex of SEXES) {
      for (const stage of AGE_STAGES) {
        const { headTop: ht, map } = bodyFor(sex, stage)
        expect(map[ht + 12].slice(10, 13), `${sex} ${stage}`).toBe('kkk')
        expect(map[ht + 14].slice(19, 22), `${sex} ${stage}`).toBe('kkk')
        expect(map[ht + 13][10]).toBe('E')
        expect(map[ht + 13][19]).toBe('E')
      }
    }
  })

  it('넥타이는 중년 남자만, 지팡이는 노년만 있다', () => {
    for (const sex of SEXES) {
      for (const stage of AGE_STAGES) {
        const flat = bodyFor(sex, stage).map.join('')
        expect(flat.includes('t'), `${sex} ${stage}`).toBe(sex === 'M' && stage === 'middle')
        expect(flat.includes('Z'), `${sex} ${stage}`).toBe(stage === 'old')
      }
    }
  })
})

describe('compose', () => {
  it('안전모 장식은 머리 맨 윗줄을 노랗게 덮는다', () => {
    const grid = compose(adult, [ADORNMENTS.courage])
    expect(grid[adult.headTop].join('')).toMatch(/[yFD]{6}/)
  })

  it('장식은 몸통을 바꾸지 않는다', () => {
    const plain = compose(adult, [])
    compose(adult, [ADORNMENTS.courage])
    expect(compose(adult, [])).toEqual(plain)
  })

  it('장식·약점 표시·표정·눈꺼풀은 팔레트 안의 색으로 그린다', () => {
    const layers: Layer[] = [
      ...Object.values(ADORNMENTS),
      ...Object.values(MARKS),
      ...Object.values(MOODS),
      EYELIDS,
    ]
    for (const layer of layers) {
      for (const ch of compose(bodyFor('F', 'old'), [layer]).flat()) {
        expect(ch === '.' || ch in CHARACTER_PALETTE).toBe(true)
      }
    }
  })
})

describe('toRects·toRuns', () => {
  it('빈 칸은 그리지 않고, 띠로 묶어도 칠한 칸 수는 같다', () => {
    const grid = compose(bodyFor('M', 'baby'), [])
    const rects = toRects(grid, CHARACTER_PALETTE)
    const runs = toRuns(grid, CHARACTER_PALETTE)
    expect(rects.length).toBeGreaterThan(0)
    expect(rects.length).toBeLessThan(CHAR_WIDTH * CHAR_HEIGHT)
    expect(runs.reduce((n, r) => n + r.width, 0)).toBe(rects.length)
    expect(runs.length).toBeLessThan(rects.length / 2)
  })
})
