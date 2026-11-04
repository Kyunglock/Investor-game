import { describe, expect, it } from 'vitest'
import { bodyFor, type View, viewBody } from './bodies'

const lastRow = (map: readonly string[]) =>
  map.reduce((last, row, y) => (/[^.]/.test(row) ? y : last), -1)

describe('옆모습·뒷모습 (decisions.md 196번)', () => {
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

  it('옆을 볼 때는 오른쪽으로 돌아선 3/4 얼굴: 가까운 오른쪽 눈이 먼 왼쪽 눈보다 넓다 (decisions.md 197번)', () => {
    const body = viewBody('M', 'adult', 'side')
    const eyeRow = body.map[body.headTop + 12]
    const eyes = [...eyeRow].map((ch, x) => (ch === 'k' ? x : -1)).filter((x) => x >= 0)
    const right = eyes.filter((x) => x >= 16).length
    const left = eyes.filter((x) => x < 16).length
    expect(right).toBeGreaterThan(left)
    expect(left).toBeGreaterThan(0)
  })

  it('뒷모습에는 얼굴(눈)이 없다', () => {
    const body = viewBody('F', 'adult', 'back')
    expect(body.map.join('')).not.toMatch(/[kE]/)
  })

  it('아기는 방향이 없어 정면 그대로다', () => {
    expect(viewBody('M', 'baby', 'side')).toBe(bodyFor('M', 'baby'))
  })
})
