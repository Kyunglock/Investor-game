import { describe, expect, it } from 'vitest'
import { bodyFor, type View, viewBody } from './bodies'

const lastRow = (map: readonly string[]) =>
  map.reduce((last, row, y) => (/[^.]/.test(row) ? y : last), -1)

describe('옆모습·뒷모습 (decisions.md 194번)', () => {
  const stages = ['child', 'adult', 'middle', 'old'] as const
  const views: View[] = ['side', 'walk', 'back']

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

  it('옆모습은 오른쪽을 본다: 눈동자가 오른쪽 절반에 하나뿐이다', () => {
    const body = viewBody('M', 'adult', 'side')
    const eyeRow = body.map[body.headTop + 13]
    const eyes = [...eyeRow]
      .map((ch, x) => (ch === 'k' || ch === 'E' ? x : -1))
      .filter((x) => x >= 0)
    expect(eyes.length).toBeGreaterThan(0)
    expect(Math.min(...eyes)).toBeGreaterThanOrEqual(16)
  })

  it('뒷모습에는 얼굴(눈)이 없다', () => {
    const body = viewBody('F', 'adult', 'back')
    expect(body.map.join('')).not.toMatch(/[kE]/)
  })

  it('아기는 방향이 없어 정면 그대로다', () => {
    expect(viewBody('M', 'baby', 'side')).toBe(bodyFor('M', 'baby'))
  })
})
