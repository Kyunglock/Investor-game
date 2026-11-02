import { describe, expect, it } from 'vitest'
import { AGE_STAGES, bodyFor } from './bodies'
import { opposite } from './sexes'

const HAIR = /[xjhHiJGIVUOQ]/
const LEGWEAR = /[zPpu]/

describe('성별 (decisions.md 69·142번)', () => {
  it('배우자는 나와 반대 성별', () => {
    expect(opposite('M')).toBe('F')
    expect(opposite('F')).toBe('M')
  })

  it('여자는 얼굴 옆으로 머리카락이 내려온다 (아기 빼고)', () => {
    for (const stage of AGE_STAGES) {
      if (stage === 'baby') {
        continue
      }
      const side = (sex: 'M' | 'F') => {
        const { headTop: ht, map } = bodyFor(sex, stage)
        return [13, 14, 15].filter(
          (dy) => HAIR.test(map[ht + dy][2]) && HAIR.test(map[ht + dy][29]),
        ).length
      }
      expect(side('F'), stage).toBe(3)
      expect(side('M'), stage).toBe(0)
    }
  })

  it('여자는 어린이부터 바지 대신 치마를 입는다', () => {
    for (const stage of AGE_STAGES) {
      if (stage === 'baby') {
        continue
      }
      expect(LEGWEAR.test(bodyFor('M', stage).map.join('')), stage).toBe(true)
      expect(LEGWEAR.test(bodyFor('F', stage).map.join('')), stage).toBe(false)
    }
  })

  it('아기 딸은 머리에 리본을 단다', () => {
    expect(bodyFor('F', 'baby').map.join('')).toContain('R')
    expect(bodyFor('M', 'baby').map.join('')).not.toContain('R')
  })
})
