import { describe, expect, it } from 'vitest'
import { playerName, UNNAMED, validName } from './playerName'

describe('이름', () => {
  it('정한 이름을 보이고, 없으면 대체 문구', () => {
    expect(playerName({ name: '김투자' })).toBe('김투자')
    expect(playerName({ name: '  ' })).toBe(UNNAMED)
    expect(playerName({ name: null })).toBe(UNNAMED)
    expect(playerName({})).toBe(UNNAMED)
  })

  it('공백을 잘라 1~8자만 저장할 수 있다', () => {
    expect(validName(' 김투자 ')).toBe(true)
    expect(validName('   ')).toBe(false)
    expect(validName('여덟글자이름입니')).toBe(true)
    expect(validName('아홉글자가넘는이름')).toBe(false)
  })
})
