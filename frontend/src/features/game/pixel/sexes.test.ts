import { describe, expect, it } from 'vitest'
import { AGE_STAGES, BODIES } from './bodies'
import { PALETTE } from './palette'
import { FEMALE, opposite, sexLayers } from './sexes'
import { compose, SPRITE_HEIGHT, SPRITE_WIDTH } from './sprite'

describe('성별 (decisions.md 69번)', () => {
  it('배우자는 나와 반대 성별', () => {
    expect(opposite('M')).toBe('F')
    expect(opposite('F')).toBe('M')
  })

  it('남자는 덧그릴 겹이 없고 여자는 나이대마다 한 겹', () => {
    expect(sexLayers('M', 'adult')).toEqual([])
    expect(sexLayers('F', 'adult')).toEqual([FEMALE.adult])
  })

  it('여자 겹은 16×20이고 팔레트에 있는 글자만 쓴다', () => {
    for (const stage of AGE_STAGES) {
      const layer = FEMALE[stage]
      if (!('map' in layer)) {
        throw new Error('map 겹이어야 한다')
      }
      expect(layer.map).toHaveLength(SPRITE_HEIGHT)
      for (const row of layer.map) {
        expect(row).toHaveLength(SPRITE_WIDTH)
        for (const ch of row) {
          expect(ch === '.' || ch in PALETTE).toBe(true)
        }
      }
    }
  })

  it('여자는 얼굴 옆에 긴 머리가 내려오고, 어린이부터는 바지 대신 치마를 입는다', () => {
    for (const stage of AGE_STAGES) {
      const body = BODIES[stage]
      const man = compose(body, [])
      const woman = compose(body, [FEMALE[stage]])
      const hair = stage === 'old' ? 'w' : 'h'
      // 머리 옆(3열·12열)에 머리카락이 생긴다.
      const side = woman.filter((row) => row[3] === hair && row[12] === hair).length
      expect(side, stage).toBeGreaterThanOrEqual(2)
      expect(man.filter((row) => row[3] === hair).length, stage).toBe(0)
      // 눈(headTop+4 줄 5·11열)은 가리지 않는다.
      expect(woman[body.headTop + 4][5]).toBe('e')
      expect(woman[body.headTop + 4][11]).toBe('e')
      if (stage !== 'baby') {
        // 바지 줄 가운데 하나는 치마(옷 색)로 덮이고, 치마가 몸보다 넓다.
        const skirt = woman.findIndex(
          (row, y) => man[y].includes('p') && row.join('').includes('c'),
        )
        expect(skirt, stage).toBeGreaterThan(0)
        expect(woman[skirt + 1].join('').replace(/\./g, '').length).toBeGreaterThan(
          woman[skirt].join('').replace(/\./g, '').length,
        )
      }
    }
  })

  it('중년 여자는 넥타이가 없다', () => {
    const woman = compose(BODIES.middle, [FEMALE.middle])
    expect(woman.flat()).not.toContain('t')
  })
})
