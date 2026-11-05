import { describe, expect, it } from 'vitest'
import { PALETTE } from '../game/pixel/palette'
import { officeMap } from './OfficeArt'
import { attireOf, customersOf, glowOf, lobbyOf, officeCaption, tierOf } from './office'

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

  it('책상 수는 자리 수이고, 지도의 글자는 모두 팔레트에 있다', () => {
    for (const grade of ['F', 'C', 'S', 'XX', 'ZZZ'] as const) {
      const map = officeMap(grade, 5, 100)
      expect(map.flat().every((ch) => ch === '.' || ch in PALETTE)).toBe(true)
    }
    const screens = (seats: number) =>
      officeMap('F', seats, 120)
        .map((row) => row.join(''))
        .join('\n')
        .match(/KZ/g)?.length ?? 0
    expect(screens(2)).toBeGreaterThan(0)
    expect(screens(4)).toBe(screens(2) * 2)
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
