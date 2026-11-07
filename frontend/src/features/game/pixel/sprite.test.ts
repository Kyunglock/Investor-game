import { describe, expect, it } from 'vitest'
import { toRects, toRuns } from './sprite'

describe('toRects·toRuns', () => {
  it('빈 칸과 팔레트에 없는 글자는 그리지 않고, 띠로 묶어도 칠한 칸 수는 같다', () => {
    const grid = ['.aab.', 'aa?aa', '.....'].map((r) => [...r])
    const palette = { a: '#111', b: '#222' }
    const rects = toRects(grid, palette)
    const runs = toRuns(grid, palette)
    expect(rects).toHaveLength(7)
    expect(runs.reduce((n, r) => n + r.width, 0)).toBe(rects.length)
    expect(runs.map((r) => r.width)).toEqual([2, 1, 2, 2])
  })
})
