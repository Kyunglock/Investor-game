import { describe, expect, it } from 'vitest'
import { ADORNMENTS } from './adornments'
import { BODIES } from './bodies'
import { PALETTE } from './palette'
import { compose, toRects } from './sprite'

describe('compose', () => {
  it('몸통만 포개면 20행 16열 격자다', () => {
    const grid = compose(BODIES.adult, [])
    expect(grid).toHaveLength(20)
    for (const row of grid) {
      expect(row).toHaveLength(16)
    }
  })

  it('안전모 장식은 머리 맨 윗줄에 노란 칸을 그린다', () => {
    const grid = compose(BODIES.adult, [ADORNMENTS.courage])
    expect(grid[BODIES.adult.headTop]).toContain('y')
  })

  it('장식은 몸통을 바꾸지 않는다', () => {
    const plain = compose(BODIES.adult, [])
    compose(BODIES.adult, [ADORNMENTS.courage])
    expect(compose(BODIES.adult, [])).toEqual(plain)
  })
})

describe('toRects', () => {
  it('빈 칸은 그리지 않고 모든 칸은 1×1이다', () => {
    const rects = toRects(compose(BODIES.baby, []), PALETTE)
    expect(rects.length).toBeGreaterThan(0)
    for (const r of rects) {
      expect(r.width).toBe(1)
      expect(r.height).toBe(1)
      expect(r.fill).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(rects.length).toBeLessThan(16 * 20)
  })
})
