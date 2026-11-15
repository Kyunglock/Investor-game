import { describe, expect, it } from 'vitest'
import { catRunSourceY, warpCatRun } from './catRunArt'

describe('고양이 보행의 연속 변형', () => {
  it('상체와 견착 손은 고정하고 골반 아래의 좌우 발만 번갈아 든다', () => {
    for (let frame = 0; frame < 8; frame++) {
      for (const x of [0, 25, 50, 75, 99]) {
        expect(catRunSourceY(x, 74, frame)).toBe(74)
        expect(catRunSourceY(x, 58, frame)).toBe(58)
      }
    }
    expect(catRunSourceY(25, 101, 2)).toBeGreaterThan(104)
    expect(catRunSourceY(75, 101, 2)).toBe(101)
    expect(catRunSourceY(25, 101, 6)).toBe(101)
    expect(catRunSourceY(75, 101, 6)).toBeGreaterThan(104)
  })
  it('발목과 좌우 경계에 점프·뒤집힘이 없다', () => {
    for (let frame = 0; frame < 8; frame++) {
      for (let x = 0; x < 100; x++) {
        for (let y = 73; y < 109; y++) {
          const delta = catRunSourceY(x, y + 1, frame) - catRunSourceY(x, y, frame)
          expect(delta).toBeGreaterThan(0)
          expect(delta).toBeLessThan(1.3)
        }
        expect(
          Math.abs(catRunSourceY(x + 1, 100, frame) - catRunSourceY(x, 100, frame)),
        ).toBeLessThan(0.17)
      }
    }
  })
  it('그림자 없는 원본의 연결된 몸과 발 사이에 빈 줄이 생기지 않는다', () => {
    const width = 100,
      height = 110
    const source = new Uint8ClampedArray(width * height * 4)
    for (let y = 15; y < 104; y++) {
      for (let x = 20; x < 80; x++) {
        if (y > 85 && x >= 46 && x <= 54) continue
        source.set([230, 150, 70, 255], (y * width + x) * 4)
      }
    }
    for (let frame = 0; frame < 8; frame++) {
      const result = warpCatRun(source, width, height, frame)
      expect(result.slice(0, 74 * width * 4)).toEqual(source.slice(0, 74 * width * 4))
      for (const x of [30, 70]) {
        let ended = false
        for (let y = 15; y < height; y++) {
          const alpha = result[(y * width + x) * 4 + 3]
          if (!alpha) ended = true
          if (ended) expect(alpha).toBe(0)
        }
      }
      expect(result[(97 * width + 50) * 4 + 3]).toBe(0)
    }
  })
})
