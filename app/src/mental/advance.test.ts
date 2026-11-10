import { describe, expect, it } from 'vitest'
import {
  BOSS,
  bossSummonSeconds,
  defenseStars,
  formation,
  numberedStageScale,
  SEGMENTS,
  stageLabel,
  stageSpec,
  stars,
} from './advance'

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

  it('스테이지가 뒤로 갈수록 구간이 늘고 단단해지며, 챕터 마지막에만 보스가 나온다', () => {
    expect(stageSpec(1).segments).toBe(3)
    expect(stageSpec(5).segments).toBe(4)
    expect(stageSpec(9).segments).toBe(5)
    expect(stageSpec(2).hpScale).toBeGreaterThan(stageSpec(1).hpScale)
    expect(stageSpec(9).boss).toBe(false)
    // 1-1은 예전 판 그대로, 뒤로 갈수록 체력·수·빠르기·멘탈 피해가 함께 오른다 (#565).
    const one = stageSpec(1)
    expect([one.hpScale, one.countScale, one.speedScale, one.dmgScale]).toEqual([1, 1, 1, 1])
    for (const key of ['hpScale', 'countScale', 'speedScale', 'dmgScale'] as const) {
      expect(stageSpec(5)[key]).toBeGreaterThan(stageSpec(4)[key])
    }
    expect(stageSpec(10).boss).toBe(true)
    expect(stageLabel(3)).toBe('1-3')
    expect(stageLabel(10)).toBe('1-10')
    expect(bossSummonSeconds(50, 100)).toBeLessThan(bossSummonSeconds(60, 100))
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

describe('디펜스 번호 스테이지의 별 (decisions.md 375번)', () => {
  it('지면 0, 버티면 1, 멘탈벽이 반 넘게 남으면 2, 80% 이상이면 3', () => {
    expect(defenseStars(false, 100, 100)).toBe(0)
    expect(defenseStars(true, 30, 100)).toBe(1)
    expect(defenseStars(true, 60, 100)).toBe(2)
    expect(defenseStars(true, 80, 100)).toBe(3)
  })
})

describe('번호 스테이지 초반 난이도', () => {
  it('첫 스테이지는 유지하고 후반은 시작부터 체력과 물량 차이가 난다', () => {
    for (const t of [0, 15, 35, 120]) {
      expect(numberedStageScale(1, t)).toBe(1)
    }
    expect(numberedStageScale(stageSpec(5).hpScale, 0)).toBeGreaterThan(3)
    expect(numberedStageScale(stageSpec(5).countScale, 0)).toBeGreaterThan(1.4)
    for (const key of ['hpScale', 'countScale', 'speedScale', 'dmgScale'] as const) {
      const scales = [1, 3, 5, 9].map((stage) => numberedStageScale(stageSpec(stage)[key], 0))
      for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1])
    }
  })
  it('35초에 목표 난이도에 도달하고 이후에는 초과하지 않는다', () => {
    const scale = stageSpec(9).hpScale
    expect(numberedStageScale(scale, -1)).toBe(numberedStageScale(scale, 0))
    expect(numberedStageScale(scale, 15)).toBeGreaterThan(numberedStageScale(scale, 0))
    expect(numberedStageScale(scale, 35)).toBe(scale)
    expect(numberedStageScale(scale, 120)).toBe(scale)
  })
})
