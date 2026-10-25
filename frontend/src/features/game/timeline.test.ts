import { describe, expect, it } from 'vitest'
import { curvePoints, yearDelta, yearFills } from './timeline'

const y = (age: number, totalAsset: number) => ({ age, totalAsset, cash: totalAsset })

describe('yearFills', () => {
  it('1세, 기록이 없으면 현재 칸과 끝 칸만 표시된다', () => {
    const fills = yearFills([], 100, 1, 1, 65)
    expect(fills).toHaveLength(65)
    expect(fills[0]).toBe('current')
    expect(fills[64]).toBe('end')
    expect(fills.slice(1, 64).every((f) => f === 'empty')).toBe(true)
  })

  it('지난 해는 전년보다 늘었으면 up, 아니면 flat', () => {
    const fills = yearFills([y(1, 100), y(2, 120), y(3, 110)], 100, 4, 1, 65)
    expect(fills.slice(0, 4)).toEqual(['flat', 'up', 'flat', 'current'])
  })

  it('65세에 끝나면 끝 칸이 현재다', () => {
    expect(yearFills([], 100, 65, 1, 65)[64]).toBe('current')
  })
})

describe('curvePoints', () => {
  it('첫 점은 시작 나이와 초기 자산이다', () => {
    expect(curvePoints([], 100, 1, 1)).toEqual([{ age: 1, totalAsset: 100 }])
  })

  it('기록을 이어 붙인다', () => {
    expect(curvePoints([y(1, 100), y(2, 130)], 100, 1, 3)).toEqual([
      { age: 1, totalAsset: 100 },
      { age: 2, totalAsset: 130 },
    ])
  })
})

describe('yearDelta (decisions.md 74번)', () => {
  it('마친 해가 없으면 null, 첫 해는 시작 자산과, 그 뒤는 전년과 비교한다', () => {
    expect(yearDelta([], 10_000_000)).toBeNull()
    expect(yearDelta([{ age: 15, totalAsset: 11_000_000, cash: 0 }], 10_000_000)).toEqual({
      age: 15,
      delta: 1_000_000,
      bp: 1_000,
    })
    expect(
      yearDelta(
        [
          { age: 15, totalAsset: 11_000_000, cash: 0 },
          { age: 16, totalAsset: 9_900_000, cash: 0 },
        ],
        10_000_000,
      ),
    ).toEqual({ age: 16, delta: -1_100_000, bp: -1_000 })
  })

  it('전년 자산이 0 이하면 변화율은 0', () => {
    expect(
      yearDelta(
        [
          { age: 40, totalAsset: -5_000_000, cash: 0 },
          { age: 41, totalAsset: 1_000_000, cash: 0 },
        ],
        0,
      ),
    ).toEqual({ age: 41, delta: 6_000_000, bp: 0 })
  })
})
