import { describe, expect, it } from 'vitest'
import { compose } from '../sprite'
import { HD_ADULT, HD_HEIGHT, HD_WIDTH } from './adult'
import { HD_MOODS } from './moods'
import { HD_PALETTE } from './palette'

describe('고해상도 시안', () => {
  it('몸통은 32×40이고 모든 글자가 팔레트에 있다', () => {
    expect(HD_ADULT.map).toHaveLength(HD_HEIGHT)
    for (const row of HD_ADULT.map) {
      expect(row).toHaveLength(HD_WIDTH)
      for (const ch of row) {
        expect(ch === '.' || ch in HD_PALETTE).toBe(true)
      }
    }
  })

  it('표정 넷은 팔레트 안의 색으로 얼굴을 바꾼다', () => {
    const plain = compose(HD_ADULT, [])
    for (const mood of Object.values(HD_MOODS)) {
      const grid = compose(HD_ADULT, [mood])
      expect(grid).not.toEqual(plain)
      for (const ch of grid.flat()) {
        expect(ch === '.' || ch in HD_PALETTE).toBe(true)
      }
    }
  })
})
