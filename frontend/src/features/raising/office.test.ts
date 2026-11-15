import { describe, expect, it } from 'vitest'
import {
  attireOf,
  customersOf,
  glowOf,
  lobbyOf,
  nextStep,
  officeCaption,
  officeName,
  tierOf,
  titleOf,
} from './office'

describe('회사 건물과 객장 (증권사 육성 설계 8.1절)', () => {
  it('등급마다 건물이 바뀐다: 반지하 → 상가 → 작은 빌딩 → 여의도 → 통째 → 사옥 → 랜드마크', () => {
    expect(['F', 'D', 'B', 'S', 'SSS', 'X', 'Z'].map((g) => tierOf(g as never))).toEqual([
      'basement',
      'shop',
      'small',
      'yeouido',
      'whole',
      'hq',
      'landmark',
    ])
    // 표에 없는 등급은 앞 단계 그림을 쓴다.
    expect(tierOf('E')).toBe('basement')
    expect(tierOf('SS')).toBe('yeouido')
  })

  it('객장 손님은 회사 등급만큼이고 F는 길고양이 한 마리다', () => {
    expect(customersOf('F')).toBe(0)
    expect(customersOf('D')).toBe(2)
    expect(lobbyOf('B').ticket).toBe(true)
    expect(lobbyOf('A').chairs).toBe(false)
    expect(lobbyOf('SSS').line).toBe(true)
    expect(lobbyOf('X').board).toBe(true)
    expect(lobbyOf('ZZ').logo).toBe(true)
  })

  it('그림을 끄면 같은 내용을 글로 보인다', () => {
    expect(officeCaption('F', 2)).toBe(
      '사무실: 반지하 원룸, 책상 2개 · 객장: 손님 없음, 길고양이 한 마리',
    )
    expect(officeCaption('S', 8)).toBe(
      '사무실: 여의도 빌딩 몇 층, 책상 8개 · 객장: 대기 의자가 꽉 참',
    )
  })
})

describe('직원 차림새 (8.2절)', () => {
  it('F 후드티 → B 셔츠 → S 정장 → SSS 맞춤 정장, 사이 등급은 앞 단계', () => {
    expect(attireOf('F')).toBe('hoodie')
    expect(attireOf('C')).toBe('hoodie')
    expect(attireOf('B')).toBe('shirt')
    expect(attireOf('S')).toBe('suit')
    expect(attireOf('SSS')).toBe('tailored')
    expect(attireOf('XX')).toBe('tailored')
  })

  it('X 이상은 파란빛, Z 이상은 금빛', () => {
    expect(glowOf('SSS')).toBeNull()
    expect(glowOf('XXX')).toBe('blue')
    expect(glowOf('Z')).toBe('gold')
  })
})

describe('건물로 보이는 회사 (decisions.md 238번)', () => {
  it('다음 등급이 다른 건물이면 이사, 같은 건물이면 사무실을 넓히고, 끝이면 없다', () => {
    expect(officeName('F')).toBe('반지하 원룸')
    expect(nextStep('F')).toEqual({ kind: 'expand' })
    expect(nextStep('E')).toEqual({ kind: 'move', to: '상가 2층' })
    expect(nextStep('SS')).toEqual({ kind: 'move', to: '여의도 빌딩 통째로' })
    expect(nextStep('ZZZ')).toBeNull()
  })
})

describe('직함 (decisions.md 256번)', () => {
  it('종합 등급이 오르면 직함도 오른다', () => {
    expect(titleOf('F')).toBe('사원')
    expect(titleOf('D')).toBe('사원')
    expect(titleOf('C')).toBe('주임')
    expect(titleOf('A')).toBe('대리')
    expect(titleOf('S')).toBe('과장')
    expect(titleOf('SS')).toBe('차장')
    expect(titleOf('SSS')).toBe('부장')
    expect(titleOf('XX')).toBe('이사')
    expect(titleOf('ZZZ')).toBe('전무')
    // ZZZ 위 직원 등급 (289번)
    expect(titleOf('XS')).toBe('부사장')
    expect(titleOf('XSS')).toBe('고문')
    expect(titleOf('GOD')).toBe('신')
    expect(glowOf('GOD')).toBe('gold')
    expect(glowOf('XS')).toBe('gold')
    expect(attireOf('GOD')).toBe('tailored')
  })
})
