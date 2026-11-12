import { describe, expect, it } from 'vitest'
import {
  chainTargets,
  densest,
  earthStats,
  lightningPlan,
  lightningStats,
  MAGIC_MAX_LEVEL,
  MAGIC_RETRY_SECONDS,
  MagicClock,
  magicCooldown,
  magicTier,
  meteorFalloff,
  meteorStats,
  nearestTo,
  RAM_SPOOL,
  ramSpeed,
  siegeTarget,
  strongest,
  sweepHits,
  waterStats,
} from './magic'

const levels = Array.from({ length: MAGIC_MAX_LEVEL }, (_, i) => i + 1)

describe('물·불·번개 마법 (decisions.md 392번)', () => {
  it('번개는 레벨마다 추가 타격 수가 두 배가 되고 같은 적을 중복해서 잇지 않는다', () => {
    expect(levels.map((level) => lightningStats(level).chains)).toEqual([2, 4, 8, 16, 32])
    const targets = Array.from({ length: 40 }, (_, i) => ({ x: i * 20, y: 0 }))
    for (const level of levels) {
      const stats = lightningStats(level)
      const chain = chainTargets(targets[0], targets, stats.chains, stats.chainRadius)
      expect(chain).toHaveLength(2 ** level)
      expect(new Set(chain).size).toBe(chain.length)
      expect(chain).not.toContain(targets[0])
    }
  })

  it('레벨이 오를수록 쿨다운은 짧아지고 피해·범위는 커진다', () => {
    for (const l of levels.slice(1)) {
      for (const m of ['water', 'meteor', 'lightning', 'earth'] as const) {
        expect(magicCooldown(m, l)).toBeLessThan(magicCooldown(m, l - 1))
      }
      expect(waterStats(l).damage).toBeGreaterThan(waterStats(l - 1).damage)
      expect(waterStats(l).half).toBeGreaterThan(waterStats(l - 1).half)
      expect(waterStats(l).slowFactor).toBeLessThan(waterStats(l - 1).slowFactor)
      expect(meteorStats(l).damage * meteorStats(l).count).toBeGreaterThan(
        meteorStats(l - 1).damage * meteorStats(l - 1).count,
      )
      expect(meteorStats(l).radius).toBeGreaterThan(meteorStats(l - 1).radius)
      expect(lightningStats(l).damage).toBeGreaterThan(lightningStats(l - 1).damage)
      expect(lightningStats(l).chains).toBeGreaterThan(lightningStats(l - 1).chains)
      expect(earthStats(l).damage).toBeGreaterThan(earthStats(l - 1).damage)
      expect(earthStats(l).siege).toBeGreaterThan(earthStats(l - 1).siege)
      expect(earthStats(l).half).toBeGreaterThan(earthStats(l - 1).half)
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
    expect(clock.due('meteor', 0, 10)).toBe(false)
    expect(clock.due('meteor', 1, 0)).toBe(true)
    clock.cast('meteor', 1, 5)
    expect(clock.due('meteor', 1, 5 + meteorStats(1).cooldown - 0.01)).toBe(false)
    expect(clock.due('meteor', 1, 5 + meteorStats(1).cooldown)).toBe(true)
    clock.retry('meteor', 8)
    expect(clock.due('meteor', 1, 8 + MAGIC_RETRY_SECONDS / 2)).toBe(false)
    clock.cast('meteor', 1, 9)
    clock.ready('meteor')
    expect(clock.due('meteor', 2, 9)).toBe(true)
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

  it('번개는 큰 매도벽 대신 몬스터를 먼저 맞히고 연쇄도 벽에 빼앗기지 않는다', () => {
    const wall = { x: 0, y: 0, hp: 1000, wall: true }
    const dump = { x: 10, y: 0, hp: 4, wall: false }
    const panic = { x: 100, y: 0, hp: 1, wall: false }
    const plans = lightningPlan(
      [wall, dump, panic],
      { x: 0, y: 200 },
      lightningStats(3),
      (e) => e.wall,
    )
    expect(plans).toEqual([{ target: dump, chain: [panic] }])
  })

  it('여러 줄기도 서로 다른 몬스터를 고르고 큰손 보스도 벽으로 취급하지 않는다', () => {
    const wall = { x: 0, y: 0, hp: 1000, wall: true }
    const boss = { x: 0, y: 50, hp: 100, wall: false }
    const dump = { x: 0, y: 100, hp: 4, wall: false }
    const plans = lightningPlan(
      [wall, boss, dump],
      { x: 0, y: 200 },
      lightningStats(5),
      (e) => e.wall,
    )
    expect(plans.map((p) => p.target)).toEqual([boss, dump])
    expect(plans.every((p) => !p.chain.includes(wall))).toBe(true)
    expect(lightningPlan([wall, dump], { x: 0, y: 200 }, lightningStats(5), (e) => e.wall)).toEqual(
      [{ target: dump, chain: [] }],
    )
  })

  it('벽만 남으면 벽을 때리고, 벽이 없는 디펜스의 타격·연쇄·거리 제한은 그대로다', () => {
    const wall = { x: 0, y: 0, hp: 100, wall: true }
    const stats = lightningStats(1)
    expect(lightningPlan([wall], { x: 0, y: 200 }, stats, (e) => e.wall)).toEqual([
      { target: wall, chain: [] },
    ])
    expect(lightningPlan([], { x: 0, y: 200 }, stats, () => false)).toEqual([])
    const dump = { x: 0, y: 0, hp: 4, wall: false }
    const panic = { x: 100, y: 0, hp: 1, wall: false }
    const far = { x: 400, y: 0, hp: 1, wall: false }
    expect(lightningPlan([dump, panic, far], { x: 0, y: 200 }, stats, (e) => e.wall)).toEqual([
      { target: dump, chain: [panic] },
    ])
  })

  it('날아가는 물은 앞뒤 depth, 옆 half 안에 걸친 적에 닿는다', () => {
    const shot = { x: 0, y: 0, dx: 0, dy: -1, half: 20, depth: 10 }
    expect(sweepHits(shot, { x: 0, y: -15 }, 8)).toBe(true)
    expect(sweepHits(shot, { x: 25, y: 0 }, 8)).toBe(true)
    expect(sweepHits(shot, { x: 30, y: 0 }, 8)).toBe(false)
    expect(sweepHits(shot, { x: 0, y: -30 }, 8)).toBe(false)
  })

  it('땅 (433번): 충차는 보통 적에겐 약하고 벽·큰손에는 다른 마법보다 세게 들이받는다', () => {
    for (const l of levels) {
      const e = earthStats(l)
      // 보통 적에게 주는 피해는 번개보다 약하다.
      expect(e.damage).toBeLessThan(lightningStats(l).damage)
      // 벽에는 초당 피해가 물·불·번개보다 세다.
      const wallDps = (e.damage * e.siege) / e.cooldown
      for (const other of [waterStats(l), lightningStats(l)]) {
        expect(wallDps).toBeGreaterThan(other.damage / other.cooldown)
      }
    }
    expect(earthStats(1).quake).toBe(0)
    expect(earthStats(2).quake).toBe(0)
    expect(earthStats(3).quake).toBeGreaterThan(0)
  })

  it('땅의 과녁: 가장 가까운 벽 칸·큰손, 없으면 체력이 가장 많은 적', () => {
    const near = { x: 0, y: -50, hp: 2, wall: false }
    const tough = { x: 300, y: -300, hp: 30, wall: false }
    const wallFar = { x: 0, y: -500, hp: 50, wall: true }
    const wallNear = { x: 0, y: -400, hp: 80, wall: true }
    const isWall = (t: { wall: boolean }) => t.wall
    const from = { x: 0, y: 0 }
    expect(siegeTarget([near, tough, wallFar, wallNear], from, isWall)).toBe(wallNear)
    expect(siegeTarget([near, tough], from, isWall)).toBe(tough)
    expect(siegeTarget([], from, isWall)).toBeNull()
  })

  it('충차는 느리게 출발해 RAM_SPOOL초 뒤 다 달린다', () => {
    expect(ramSpeed(1000, 0)).toBeCloseTo(350)
    expect(ramSpeed(1000, RAM_SPOOL / 2)).toBeGreaterThan(350)
    expect(ramSpeed(1000, RAM_SPOOL)).toBeCloseTo(1000)
    expect(ramSpeed(1000, 5)).toBeCloseTo(1000)
  })
})

describe('메테오 착탄', () => {
  it('중심에서 가장자리까지 피해가 줄고 범위 밖은 맞지 않는다', () => {
    expect(meteorFalloff(0, 100)).toBe(1)
    expect(meteorFalloff(50, 100)).toBeCloseTo(0.825)
    expect(meteorFalloff(100, 100)).toBeCloseTo(0.65)
    expect(meteorFalloff(101, 100)).toBe(0)
  })
  it('화상 포함 옛 불 마법의 중심 초당 피해를 유지하며 유성우 수가 늘어난다', () => {
    const old = [4 / 3, 6.75 / 2.7, 10 / 2.4, 11.8 / 2.2, 13.6 / 2]
    for (let l = 1; l <= 5; l++) {
      const s = meteorStats(l)
      expect((s.damage * s.count) / s.cooldown / old[l - 1]).toBeCloseTo(1, 1)
      expect(s.warning).toBeGreaterThanOrEqual(0.4)
      expect(s.warning).toBeLessThanOrEqual(0.6)
      expect(s.stunSeconds).toBeGreaterThanOrEqual(0.3)
      expect(s.stunSeconds).toBeLessThanOrEqual(0.5)
    }
    expect([1, 2, 3, 4, 5].map((l) => meteorStats(l).count)).toEqual([1, 1, 3, 3, 4])
  })
})
