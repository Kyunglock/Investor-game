import { describe, expect, it } from 'vitest'
import { bodyFor, type View, viewBody } from './bodies'

const lastRow = (map: readonly string[]) =>
  map.reduce((last, row, y) => (/[^.]/.test(row) ? y : last), -1)

describe('뒷모습 (decisions.md 196·199번)', () => {
  const stages = ['child', 'adult', 'middle', 'old'] as const
  const views: View[] = ['back']

  it('정면과 같은 크기이고 발이 같은 줄에 닿는다', () => {
    for (const sex of ['M', 'F'] as const) {
      for (const stage of stages) {
        const front = bodyFor(sex, stage)
        for (const view of views) {
          const body = viewBody(sex, stage, view)
          expect(body.map, `${sex} ${stage} ${view}`).toHaveLength(40)
          expect(body.map.every((r) => r.length === 32)).toBe(true)
          expect(lastRow(body.map), `${sex} ${stage} ${view}`).toBe(lastRow(front.map))
        }
      }
    }
  })

  it('뒷모습에는 얼굴(눈)이 없다', () => {
    const body = viewBody('F', 'adult', 'back')
    expect(body.map.join('')).not.toMatch(/[kE]/)
  })

  it('아기는 방향이 없어 정면 그대로다', () => {
    expect(viewBody('M', 'baby', 'back')).toBe(bodyFor('M', 'baby'))
  })
})
