import { describe, expect, it } from 'vitest'
import { gradeOf } from './grade'

describe('gradeOf', () => {
  it('띠의 경계에서 등급이 바뀐다 (서버 StatGrade와 같다)', () => {
    expect(gradeOf(100)).toBe('SSS')
    expect(gradeOf(90)).toBe('SSS')
    expect(gradeOf(89)).toBe('SS')
    expect(gradeOf(80)).toBe('SS')
    expect(gradeOf(70)).toBe('S')
    expect(gradeOf(60)).toBe('A')
    expect(gradeOf(50)).toBe('B')
    expect(gradeOf(40)).toBe('C')
    expect(gradeOf(30)).toBe('D')
    expect(gradeOf(20)).toBe('E')
    expect(gradeOf(19)).toBe('F')
    expect(gradeOf(0)).toBe('F')
  })
})
