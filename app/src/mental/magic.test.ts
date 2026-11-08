import { describe, expect, it } from 'vitest'
import {
  chainTargets,
  densest,
  fireStats,
  lightningStats,
  MAGIC_MAX_LEVEL,
  MAGIC_RETRY_SECONDS,
  MagicClock,
  magicCooldown,
  magicTier,
  nearestTo,
  strongest,
  sweepHits,
  waterStats,
} from './magic'

const levels = Array.from({ length: MAGIC_MAX_LEVEL }, (_, i) => i + 1)

describe('물·불·번개 마법 (decisions.md 392번)', () => {
  it('레벨이 오를수록 쿨다운은 짧아지고 피해·범위는 커진다', () => {
    for (const l of levels.slice(1)) {
      for (const m of ['water', 'fire', 'lightning'] as const) {
        expect(magicCooldown(m, l)).toBeLessThan(magicCooldown(m, l - 1))
      }
      expect(waterStats(l).damage).toBeGreaterThan(waterStats(l - 1).damage)
      expect(waterStats(l).half).toBeGreaterThan(waterStats(l - 1).half)
      expect(waterStats(l).slowFactor).toBeLessThan(waterStats(l - 1).slowFactor)
      expect(fireStats(l).damage).toBeGreaterThan(fireStats(l - 1).damage)
      expect(fireStats(l).radius).toBeGreaterThan(fireStats(l - 1).radius)
      expect(lightningStats(l).damage).toBeGreaterThan(lightningStats(l - 1).damage)
      expect(lightningStats(l).chains).toBeGreaterThan(lightningStats(l - 1).chains)
    }
  })

  it('물방울은 처음 맞은 적에서 터지고, 물줄기부터 꿰뚫는다', () => {
    expect(waterStats(1)).toMatchObject({ pierce: false })
    expect(waterStats(1).splash).toBeGreaterThan(0)
    expect(waterStats(2).pierce).toBe(true)
  })

  it('연출은 세 단계이고 4·5레벨은 3단계 연출을 쓴다', () => {
    expect(levels.map(magicTier)).toEqual([1, 2, 3, 3, 3])
    expect(waterStats(99)).toEqual(waterStats(MAGIC_MAX_LEVEL))
  })

  it('마법 시계: 처음 배우면 바로 나가고, 쏜 뒤에는 쿨다운만큼 기다린다', () => {
    const clock = new MagicClock()
    expect(clock.due('fire', 0, 10)).toBe(false)
    expect(clock.due('fire', 1, 0)).toBe(true)
    clock.cast('fire', 1, 5)
    expect(clock.due('fire', 1, 5 + fireStats(1).cooldown - 0.01)).toBe(false)
    expect(clock.due('fire', 1, 5 + fireStats(1).cooldown)).toBe(true)
    clock.retry('fire', 8)
    expect(clock.due('fire', 1, 8 + MAGIC_RETRY_SECONDS / 2)).toBe(false)
    clock.cast('fire', 1, 9)
    clock.ready('fire')
    expect(clock.due('fire', 2, 9)).toBe(true)
    // 다른 마법의 시계는 따로 돈다.
    expect(clock.due('water', 1, 9)).toBe(true)
    // 고양이가 여럿이면 시전자마다 조금씩 늦춰 한꺼번에 겹치지 않게 한다 (393번).
    clock.ready('water', 9.36)
    expect(clock.due('water', 1, 9.2)).toBe(false)
    expect(clock.due('water', 1, 9.36)).toBe(true)
  })

  it('과녁: 물은 가장 가까운 적, 불은 가장 몰린 적, 번개는 체력이 가장 많은 적', () => {
    const a = { x: 0, y: 0, hp: 1 }
    const b = { x: 200, y: 0, hp: 1 }
    const c = { x: 230, y: 10, hp: 16 }
    const d = { x: 210, y: 30, hp: 4 }
    const list = [a, b, c, d]
    expect(nearestTo(list, { x: 10, y: 5 })).toBe(a)
    expect(densest(list, 50)).toBe(b)
    expect(strongest(list, { x: 0, y: 0 })).toBe(c)
    expect(strongest(list, { x: 0, y: 0 }, [c])).toBe(d)
    // 체력이 같으면 가까운 쪽.
    expect(strongest([b, a], { x: 0, y: 0 })).toBe(a)
    expect(nearestTo([], { x: 0, y: 0 })).toBeNull()
  })

  it('번개는 맞은 적에서 가까운 적으로 차례로 튀고, 거리 밖이나 맞은 적에게는 튀지 않는다', () => {
    const first = { x: 0, y: 0 }
    const p1 = { x: 100, y: 0 }
    const p2 = { x: 190, y: 0 }
    const p3 = { x: 40, y: 0 }
    const far = { x: 600, y: 0 }
    const list = [first, p1, p2, p3, far]
    expect(chainTargets(first, list, 3, 100)).toEqual([p3, p1, p2])
    expect(chainTargets(first, list, 9, 100)).toHaveLength(3)
    expect(chainTargets(first, list, 1, 30)).toEqual([])
  })

  it('날아가는 물은 앞뒤 depth, 옆 half 안에 걸친 적에 닿는다', () => {
    const shot = { x: 0, y: 0, dx: 0, dy: -1, half: 20, depth: 10 }
    expect(sweepHits(shot, { x: 0, y: -15 }, 8)).toBe(true)
    expect(sweepHits(shot, { x: 25, y: 0 }, 8)).toBe(true)
    expect(sweepHits(shot, { x: 30, y: 0 }, 8)).toBe(false)
    expect(sweepHits(shot, { x: 0, y: -30 }, 8)).toBe(false)
  })
})
