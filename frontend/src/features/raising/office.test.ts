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

  it('모니터 주가 선은 그해 손익을 따르고 빈 책상은 꺼져 있다 (237번)', () => {
    const lines = (screen: 'up' | 'down' | 'off') => {
      const map = officeMap('F', 1, 64, [screen])
      const at: [number, number][] = []
      map.forEach((row, y) => {
        row.forEach((ch, x) => {
          if (ch === 'U' || ch === 'B') {
            at.push([x, y])
          }
        })
      })
      at.sort((a, b) => a[0] - b[0])
      return { color: new Set(at.map(([x, y]) => map[y][x])), at }
    }
    const up = lines('up')
    const down = lines('down')
    expect([...up.color]).toEqual(['U'])
    expect([...down.color]).toEqual(['B'])
    // 오르면 오른쪽이 위(작은 y), 내리면 오른쪽이 아래
    expect(up.at.at(-1)?.[1]).toBeLessThan(up.at[0][1])
    expect(down.at.at(-1)?.[1]).toBeGreaterThan(down.at[0][1])
    expect(lines('off').at).toHaveLength(0)
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
