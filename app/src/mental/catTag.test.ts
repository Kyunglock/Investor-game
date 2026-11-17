import { describe, expect, it } from 'vitest'
import { catAt, TAG_STYLES, tagText } from './catTag'

describe('전투의 고양이 이름표 (605번)', () => {
  it('등급과 이름을 적고, 높은 등급은 표시를 단다', () => {
    expect(tagText({ code: 'sky', name: '하늘냥', grade: 'C' })).toBe('C 하늘냥')
    expect(tagText({ code: 'night', name: '밤냥', grade: 'A' })).toBe('◆ A 밤냥')
    expect(tagText({ code: 'snow', name: '눈꽃냥', grade: 'S' })).toBe('★ S 눈꽃냥')
    expect(tagText({ code: 'boss', name: '사장냥' })).toBe('♛ 사장냥')
  })
  it('등급이 높을수록 크고, S만 빛나며 숨 쉰다', () => {
    expect(TAG_STYLES.S.size).toBeGreaterThan(TAG_STYLES.A.size)
    expect(TAG_STYLES.A.size).toBeGreaterThan(TAG_STYLES.B.size)
    expect(TAG_STYLES.B.glow).toBeNull()
    expect(TAG_STYLES.A.glow).not.toBeNull()
    expect([TAG_STYLES.C.pulse, TAG_STYLES.A.pulse, TAG_STYLES.S.pulse]).toEqual([
      false,
      false,
      true,
    ])
  })
  it('꾹 누른 자리에서 가장 가까운 고양이를 고른다', () => {
    const spots = [
      { x: 60, y: 700 },
      { x: 130, y: 700 },
      { x: 200, y: 700 },
    ]
    expect(catAt(spots, 62, 690)).toBe(0)
    expect(catAt(spots, 170, 700)).toBe(2)
    expect(catAt(spots, 128, 720)).toBe(1)
    expect(catAt(spots, 200, 400)).toBe(-1)
  })
})
