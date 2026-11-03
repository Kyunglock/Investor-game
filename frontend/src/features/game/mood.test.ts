import { describe, expect, it } from 'vitest'
import { familyNote, moodNote } from './mood'

describe('행복도·가족 점수의 영향 문구 (decisions.md 165번)', () => {
  it('행복도는 30 아래면 흔들리고 70부터 단단하다', () => {
    expect(moodNote(29)).toContain('흔들린다')
    expect(moodNote(30)).toBe('마음이 평온하다')
    expect(moodNote(69)).toBe('마음이 평온하다')
    expect(moodNote(70)).toContain('단단하다')
  })
  it('가족 점수는 20 아래면 멀어지고 70부터 든든하다', () => {
    expect(familyNote(19)).toContain('멀어졌다')
    expect(familyNote(20)).toContain('그럭저럭')
    expect(familyNote(70)).toContain('든든하다')
  })
})
