import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { PALETTE } from '../game/pixel/palette'
import { buildingMap } from './BuildingArt'
import { LADDER } from './grades'
import {
  attireOf,
  customersOf,
  glowOf,
  lobbyOf,
  nextStep,
  officeCaption,
  officeName,
  seatTiles,
  tierOf,
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

  it('미니맵 칸은 자리 수만큼이고 앉은 사람이 앞에서 채우며, 표정은 지난 결산 손익을 따른다 (237번)', () => {
    const company = {
      seats: 3,
      desks: [
        { code: 'bio', name: '바이오 데스크', trades: true },
        { code: 'research', name: '리서치 팀', trades: false },
      ],
      employees: [
        { id: 1, name: '가', desk: 'bio' },
        { id: 2, name: '나', desk: null },
        { id: 3, name: '다', desk: 'research' },
        { id: 4, name: '라', desk: 'bio' },
      ],
      lastSettlement: {
        results: [
          { employeeId: 1, stake: 100, pnl: -5 },
          { employeeId: 4, stake: 100, pnl: 7 },
        ],
      },
    } as unknown as Company
    const { tiles, resting } = seatTiles(company)
    expect(tiles.map((t) => t.employee?.name ?? null)).toEqual(['가', '다', '라'])
    expect(tiles.map((t) => t.desk)).toEqual(['바이오 데스크', '리서치 팀', '바이오 데스크'])
    expect(tiles.map((t) => t.trades)).toEqual([true, false, true])
    expect(tiles.map((t) => t.mood)).toEqual(['despair', null, 'joy'])
    expect(tiles.map((t) => t.pnl)).toEqual([-5, null, 7])
    expect(resting.map((e) => e.name)).toEqual(['나'])
    const empty = seatTiles({ ...company, seats: 5 }).tiles
    expect(empty.slice(3).map((t) => [t.index, t.employee])).toEqual([
      [3, null],
      [4, null],
    ])
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

  it('모든 등급의 건물 그림은 팔레트 글자만 쓰고, 우리 층은 불이 켜져 있다', () => {
    for (const grade of LADDER) {
      const map = buildingMap(grade)
      expect(map.flat().every((ch) => ch in PALETTE)).toBe(true)
      expect(map.flat()).toContain('L')
    }
    // 건물이 클수록 불 켜진 창이 많다.
    const lit = (g: (typeof LADDER)[number]) =>
      buildingMap(g)
        .flat()
        .filter((c) => c === 'L').length
    expect(lit('F')).toBeLessThan(lit('D'))
    expect(lit('S')).toBeLessThan(lit('SSS'))
  })
})

describe('라이벌 박치기 장면의 건물 (decisions.md 243번)', () => {
  it('건물만 그리면 하늘·이웃 건물·길바닥 없이 건물 칸은 그대로다', () => {
    for (const grade of ['F', 'D', 'B', 'S', 'SSS', 'X', 'Z'] as const) {
      const full = buildingMap(grade)
      const bare = buildingMap(grade, true)
      expect(bare[0][0]).toBe('.')
      expect(bare.at(-1)?.[0]).toBe('.')
      // 불 켜진 창(우리 층)은 둘 다 같다.
      const lit = (g: string[][]) => g.flat().filter((c) => c === 'L').length
      expect(lit(bare)).toBe(lit(full))
      expect(bare.flat().every((ch) => ch === '.' || ch in PALETTE)).toBe(true)
    }
  })
})
