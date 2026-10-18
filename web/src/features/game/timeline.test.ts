import { describe, expect, it } from 'vitest'
import { curvePoints, yearFills } from './timeline'

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
