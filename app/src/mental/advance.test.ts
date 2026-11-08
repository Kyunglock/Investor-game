import { describe, expect, it } from 'vitest'
import { BOSS, bossSummonSeconds, formation, SEGMENTS, stars } from './advance'

describe('전진 모드', () => {
  it('구간은 다섯이고 뒤로 갈수록 길막 적이 많다', () => {
    expect(SEGMENTS).toHaveLength(5)
    const total = SEGMENTS.map((s) => s.blockers.reduce((n, b) => n + b.count, 0))
    for (let i = 1; i < total.length; i++) {
      expect(total[i]).toBeGreaterThan(total[i - 1])
    }
  })

  it('길막 적은 화면 안 가로에 줄 서서 위 바깥에서 들어온다', () => {
    const width = 400
    for (const segment of SEGMENTS) {
      const spots = formation(segment, width)
      expect(spots).toHaveLength(segment.blockers.reduce((n, b) => n + b.count, 0))
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(0)
        expect(s.x).toBeLessThan(width)
        expect(s.y).toBeLessThan(0)
      }
    }
  })

  it('보스는 체력이 반 아래로 떨어지면 졸개를 더 자주 부른다', () => {
    expect(bossSummonSeconds(BOSS.hp)).toBe(BOSS.summonSeconds)
    expect(bossSummonSeconds(BOSS.hp / 2)).toBeLessThan(BOSS.summonSeconds)
    expect(bossSummonSeconds(1)).toBeLessThan(BOSS.summonSeconds)
  })

  it('별: 깨면 하나, 절반 시간 안이면 하나 더, 멘탈을 반 넘게 남기면 하나 더', () => {
    const base = { win: true, seconds: 100, mentalLeft: 20, maxMental: 100 }
    expect(stars(base, 120)).toBe(1)
    expect(stars({ ...base, seconds: 60 }, 120)).toBe(2)
    expect(stars({ ...base, mentalLeft: 51 }, 120)).toBe(2)
    expect(stars({ ...base, seconds: 50, mentalLeft: 90 }, 120)).toBe(3)
    expect(stars({ ...base, win: false, seconds: 10, mentalLeft: 100 }, 120)).toBe(0)
  })
})
