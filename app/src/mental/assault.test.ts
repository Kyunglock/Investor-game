import { describe, expect, it } from 'vitest'
import {
  ASSAULT_BOSS,
  ASSAULT_COLS,
  ASSAULT_MOTION,
  ASSAULT_RUSH,
  ASSAULT_SECONDS,
  ASSAULT_WALLS,
  assaultPrice,
  assaultSpec,
  assaultStars,
  assaultTarget,
  cellShares,
  climbSpeed,
  orderPriceStep,
  pickFlow,
  rowHps,
  rushSpawnSeconds,
  spawnSeconds,
  swarmSize,
  WEAK_CELL,
  wallBreakXp,
  wallCols,
  whaleSummonSeconds,
} from './assault'
import { BUY_ORDER_SPEED } from './buyWall'
import { xpToNext } from './cards'
import { ENEMIES, ORDERS, UNITS } from './enemies'

/** 같은 순서로 도는 가짜 난수. */
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('공격 판: 매도벽 (decisions.md 413번)', () => {
  it('열 벽(#593): 다섯째는 중간 큰손, 마지막만 대량 매도벽+큰손이고 가장 두껍다. 벽 뒤로 갈수록 물량이 잦다', () => {
    expect(ASSAULT_WALLS).toHaveLength(10)
    expect(ASSAULT_WALLS.map((w) => Boolean(w.mid))).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(ASSAULT_WALLS.map((w) => w.boss)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ])
    expect(ASSAULT_WALLS.at(-1)?.rows).toBe(Math.max(...ASSAULT_WALLS.map((w) => w.rows)))
    for (let i = 1; i < ASSAULT_WALLS.length; i++)
      expect(ASSAULT_WALLS[i].spawnSeconds).toBeLessThan(ASSAULT_WALLS[i - 1].spawnSeconds)
    const total = (w: (typeof ASSAULT_WALLS)[number]) => w.rows * w.cellHp
    expect(total(ASSAULT_WALLS[9])).toBeGreaterThan(total(ASSAULT_WALLS[0]) * 2)
    expect(ASSAULT_SECONDS).toBe(180)
  })

  it('세기가 커져도 물량 빠르기는 1.6배까지, 중간 큰손은 큰손의 절반', () => {
    expect(assaultSpec(30).enemySpeed).toBe(1.6)
    expect(assaultSpec(3).midBossHp).toBeCloseTo(assaultSpec(3).bossHp * 0.5)
  })

  it('잡몹 구간은 다음 벽보다 잦게 나오고, 물량 하나를 잡으면 한 칸의 5%가 오른다', () => {
    const spec = assaultSpec(1, { price: 52000 })
    expect(rushSpawnSeconds(ASSAULT_WALLS[1], spec)).toBeLessThan(ASSAULT_WALLS[1].spawnSeconds)
    expect(orderPriceStep(spec)).toBe(52)
    expect(ASSAULT_RUSH.seconds).toBeGreaterThan(0)
  })

  it('level이 오르면 벽·물량·보스가 함께 세지고, 1 아래는 1로 본다', () => {
    const one = assaultSpec(1)
    const three = assaultSpec(3)
    expect(assaultSpec(0)).toEqual(one)
    expect(assaultSpec(Number.NaN)).toEqual(one)
    expect(one.walls[0].cellHp).toBe(ASSAULT_WALLS[0].cellHp)
    for (const [i, w] of three.walls.entries())
      expect(w.cellHp).toBeGreaterThan(one.walls[i].cellHp)
    for (const key of ['enemyHp', 'enemySpeed', 'enemyDmg', 'enemyCount', 'bossHp'] as const) {
      expect(three[key]).toBeGreaterThan(one[key])
    }
    expect(one.bossHp).toBe(ASSAULT_BOSS.hp)
    expect(assaultSpec(1.5).walls[0].cellHp).toBeGreaterThan(one.walls[0].cellHp)
  })

  it('가격은 벽 하나에 한 칸씩 오르고, 목표가는 다 부순 가격(+100%, 457번)이다', () => {
    const spec = assaultSpec(1, { price: 52000, name: '삼성전자' })
    expect(spec.name).toBe('삼성전자')
    expect(spec.tick).toBe(5200)
    expect(assaultPrice(spec, 0)).toBe(52000)
    expect(assaultPrice(spec, 2)).toBe(62400)
    expect(assaultTarget(spec)).toBe(52000 * 2)
    expect(assaultPrice(spec, 99)).toBe(assaultTarget(spec))
  })

  it('한 줄의 체력은 칸 수와 상관없이 같고, 줄마다 약한 칸이 하나 있다', () => {
    const r = seq(0.4, 0.1, 0.9, 0.5, 0.3, 0.7, 0.2)
    for (const cols of [ASSAULT_COLS, ASSAULT_COLS - 1]) {
      const hps = rowHps(10, cols, r)
      expect(hps).toHaveLength(cols)
      expect(hps.reduce((a, b) => a + b, 0)).toBeCloseTo(10 * ASSAULT_COLS)
      const base = (10 * ASSAULT_COLS) / cols
      expect(hps.filter((hp) => hp < base * WEAK_CELL)).toHaveLength(1)
    }
    expect(wallCols(390)).toBe(ASSAULT_COLS)
    expect(wallCols(320)).toBe(ASSAULT_COLS - 1)
  })

  it('칸의 물량은 체력에 비례하고 100주 단위, 맞을수록 깎이고 부서지면 0', () => {
    expect(cellShares(8, 8)).toBe(1200)
    expect(cellShares(8, 4)).toBe(600)
    expect(cellShares(8, 0.01)).toBe(100)
    expect(cellShares(8, 0)).toBe(0)
  })

  it('벽 앞에 오래 막힐수록 물량이 잦고, 다가오는 중에는 느리다', () => {
    const spec = assaultSpec(1)
    const wall = spec.walls[2]
    expect(spawnSeconds(wall, spec, 0, true)).toBeCloseTo(wall.spawnSeconds)
    expect(spawnSeconds(wall, spec, 30, true)).toBeLessThan(spawnSeconds(wall, spec, 0, true))
    expect(spawnSeconds(wall, spec, 0, false)).toBeGreaterThan(spawnSeconds(wall, spec, 0, true))
    expect(spawnSeconds(wall, spec, 1e6, true)).toBe(0.3)
    expect(spawnSeconds(wall, assaultSpec(4), 0, true)).toBeLessThan(
      spawnSeconds(wall, spec, 0, true),
    )
  })

  it('물량 종류는 비중대로, 시장가는 떼로', () => {
    const mix = { order: 1, market: 1 }
    expect(pickFlow(mix, 0)).toBe('order')
    expect(pickFlow(mix, 0.99)).toBe('market')
    expect(pickFlow({ bulk: 1 }, 0.5)).toBe('bulk')
    expect(swarmSize(assaultSpec(1), 0)).toBeGreaterThanOrEqual(3)
    expect(swarmSize(assaultSpec(5), 0.99)).toBeGreaterThan(swarmSize(assaultSpec(1), 0.99))
  })

  it('벽을 뚫으면 쭉 치고 올랐다가 천천히, 줄인 움직임이면 고르게', () => {
    expect(climbSpeed(0)).toBe(ASSAULT_MOTION.dash)
    expect(climbSpeed(ASSAULT_MOTION.dashSeconds / 2)).toBeLessThan(ASSAULT_MOTION.dash)
    expect(climbSpeed(ASSAULT_MOTION.dashSeconds / 2)).toBeGreaterThan(ASSAULT_MOTION.drift)
    expect(climbSpeed(10)).toBe(ASSAULT_MOTION.drift)
    expect(climbSpeed(0, true)).toBe(climbSpeed(10, true))
  })

  it('큰손은 체력이 반 아래면 더 자주 쏟아 낸다', () => {
    expect(whaleSummonSeconds(100, 100)).toBe(ASSAULT_BOSS.summonSeconds)
    expect(whaleSummonSeconds(50, 100)).toBeLessThan(ASSAULT_BOSS.summonSeconds)
  })

  it('모든 공격 구간에 패닉셀과 투매가 매도 주문과 함께 나온다', () => {
    for (const wall of ASSAULT_WALLS) {
      const kinds = new Set(Array.from({ length: 1000 }, (_, i) => pickFlow(wall.mix, i / 1000)))
      expect(kinds.has('panic')).toBe(true)
      expect(kinds.has('dump')).toBe(true)
      expect(kinds.has('order')).toBe(true)
    }
  })

  it('손절은 처음부터, 투기는 셋째 벽부터, 공매도는 넷째 벽부터 섞여 나온다', () => {
    const kindsAt = (i: number) =>
      new Set(Array.from({ length: 1000 }, (_, j) => pickFlow(ASSAULT_WALLS[i].mix, j / 1000)))
    expect(kindsAt(0).has('stop')).toBe(true)
    expect(kindsAt(0).has('spec')).toBe(false)
    expect(kindsAt(2).has('spec')).toBe(true)
    expect(kindsAt(3).has('short')).toBe(true)
    const last = kindsAt(ASSAULT_WALLS.length - 1)
    for (const k of ['stop', 'spec', 'short']) expect(last.has(k as never)).toBe(true)
  })

  it('매도 물량: 매수 주문과 같은 빠르기, 대량 매도는 묵직하고 느리고, 허매도는 경험치가 없다', () => {
    expect(ORDERS.order.speed).toBe(BUY_ORDER_SPEED)
    expect(ORDERS.market.speed).toBe(BUY_ORDER_SPEED)
    expect(ORDERS.fake.speed).toBe(BUY_ORDER_SPEED)
    expect(ORDERS.market.r).toBeLessThan(ORDERS.order.r)
    expect(ORDERS.bulk.speed).toBeLessThan(ORDERS.order.speed)
    expect(ORDERS.bulk.hp).toBeGreaterThan(ORDERS.order.hp)
    expect(ORDERS.fake.reward).toBe(0)
    // 디펜스 출전 화면의 적 소개(ENEMIES)에는 매도 물량이 섞이지 않는다.
    expect(Object.keys(ENEMIES).sort()).toEqual(['dump', 'panic', 'short', 'spec', 'stop'])
    expect(UNITS.order).toBe(ORDERS.order)
  })

  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 2],
    [9, 2],
  ])('미완료 %i개 돌파(10개 중)는 별 %i개', (walls, expected) => {
    expect(assaultStars(false, walls)).toBe(expected)
  })

  it('시간 안에 모두 돌파하면 남은 멘탈이나 소요 시간과 관계없이 별 셋이다', () => {
    expect(assaultStars(true, 10)).toBe(3)
    expect(assaultStars(false, 10)).toBe(2)
  })
})

describe('매도벽 경험치 (#700)', () => {
  it('층 하나에 30, 벽을 무너뜨리면 다음 레벨까지의 40%를 더 준다', () => {
    expect(ORDERS.cell.reward).toBe(30)
    expect(wallBreakXp(105)).toBe(42)
    expect(wallBreakXp(xpToNext(5))).toBe(Math.round(xpToNext(5) * 0.4))
    expect(wallBreakXp(0)).toBe(1)
  })
})
