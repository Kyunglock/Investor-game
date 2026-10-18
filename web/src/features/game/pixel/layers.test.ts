import { describe, expect, it } from 'vitest'
import type { Stats } from '../../../api/client'
import { stageFor } from './bodies'
import { layersFor } from './layers'

const stats = (
  insight: number,
  patience: number,
  courage: number,
  conviction: number,
  luck: number,
): Stats => ({ insight, patience, courage, conviction, luck })

describe('stageFor', () => {
  it('나이 구간: 아기 1~6, 어린이 7~13, 청년 14~39, 중년 40~64, 노년 65', () => {
    expect(stageFor(1)).toBe('baby')
    expect(stageFor(6)).toBe('baby')
    expect(stageFor(7)).toBe('child')
    expect(stageFor(13)).toBe('child')
    expect(stageFor(14)).toBe('adult')
    expect(stageFor(39)).toBe('adult')
    expect(stageFor(40)).toBe('middle')
    expect(stageFor(64)).toBe('middle')
    expect(stageFor(65)).toBe('old')
  })
})

describe('layersFor', () => {
  const initial = stats(80, 50, 20, 50, 50)

  it('강점은 머리장식, 약점은 표시가 된다', () => {
    expect(layersFor(initial, initial, 31)).toEqual({
      stage: 'adult',
      adornment: 'insight',
      mark: 'courage',
    })
  })

  it('약점은 현재 능력치로, 장식은 태어날 때 능력치로 정한다', () => {
    const grown = stats(80, 50, 60, 50, 20)
    expect(layersFor(initial, grown, 31)).toEqual({
      stage: 'adult',
      adornment: 'insight',
      mark: 'luck',
    })
  })

  it('특별 별명은 왕관·반창고·없음이고 약점 표시가 없다', () => {
    const all75 = stats(75, 75, 75, 75, 75)
    expect(layersFor(all75, all75, 1)).toEqual({ stage: 'baby', adornment: 'genius', mark: null })
    const all20 = stats(20, 20, 20, 20, 20)
    expect(layersFor(all20, all20, 65)).toEqual({ stage: 'old', adornment: 'rough', mark: null })
    const flat = stats(50, 52, 54, 56, 58)
    expect(layersFor(flat, flat, 40)).toEqual({ stage: 'middle', adornment: null, mark: null })
  })
})
