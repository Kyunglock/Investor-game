import { describe, expect, it } from 'vitest'
import {
  addWalls,
  type BattleStats,
  IDLE_GAP_MS,
  record,
  resetLeft,
  STATS_WINDOW_MS,
  sharesText,
  summarize,
  windowStart,
} from './battleStats'

/** 14:03:00 (UTC): 14:00 ~ 14:10 창의 3분째. */
const T = Date.UTC(2026, 10, 21, 14, 3, 0)
const cats = [
  { code: 'night', name: '밤냥', skills: [{ code: 'bolt', name: '번개 스킬' }] },
  { code: 'sky', name: '하늘냥', skills: [] },
]

describe('전투 통계 (645번)', () => {
  it('창은 시계에 맞춘 10분이고 경계를 넘으면 처음부터 센다', () => {
    expect(windowStart(T)).toBe(Date.UTC(2026, 10, 21, 14, 0, 0))
    let s: BattleStats | null = record(null, T, {
      kind: 'bullet',
      damage: 10,
      owner: 'boss',
      crit: false,
    })
    expect(summarize(s, T, cats).left).toBe(7 * 60_000)
    expect(resetLeft(summarize(s, T, cats).left)).toBe('7분 0초')
    // 14:10을 넘으면 비어 있다. 새 명중은 새 창에 들어간다.
    const next = Date.UTC(2026, 10, 21, 14, 10, 1)
    expect(summarize(s, next, cats).total).toBe(0)
    s = record(s, next, { kind: 'bullet', damage: 3, owner: 'sky', crit: false })
    expect(s.start).toBe(windowStart(next))
    expect(summarize(s, next, cats).total).toBe(3)
    expect(STATS_WINDOW_MS).toBe(600_000)
  })

  it('고양이마다 총과 그 고양이 스킬을 더해 많이 넣은 차례로 줄 세운다', () => {
    let s: BattleStats | null = null
    s = record(s, T, { kind: 'bullet', damage: 30, owner: 'boss', crit: false })
    s = record(s, T + 100, { kind: 'bullet', damage: 20, owner: 'night', crit: true })
    s = record(s, T + 200, { kind: 'bolt', damage: 40, owner: null, crit: false })
    s = record(s, T + 300, { kind: 'bullet', damage: 5, owner: 'sky', crit: false })
    s = record(s, T + 400, { kind: 'buy', damage: 5, owner: null, crit: false })
    s = record(s, T + 500, { kind: 'barrage', damage: 0, owner: null, crit: false })
    const sum = summarize(s, T + 500, cats)
    expect(sum.total).toBe(100)
    expect(sum.rows.map((r) => [r.code, r.damage, r.skill])).toEqual([
      ['night', 60, 40],
      ['boss', 30, 0],
      ['sky', 5, 0],
    ])
    expect(sum.rows[0].share).toBeCloseTo(0.6)
    expect(sum.rows[1].name).toBe('사장냥')
    expect(sum.skillShare).toBeCloseTo(0.4)
    expect(sum.buyShare).toBeCloseTo(0.05)
    expect(sum.shots).toBe(3)
    expect(sum.crits).toBe(1)
    expect(sum.best).toBe(40)
  })

  it('초당 피해는 싸운 시간으로 나누고 긴 틈은 쉰 것으로 뺀다', () => {
    let s: BattleStats | null = record(null, T, {
      kind: 'bullet',
      damage: 10,
      owner: 'boss',
      crit: false,
    })
    s = record(s, T + 1000, { kind: 'bullet', damage: 10, owner: 'boss', crit: false })
    // 1분을 쉬었다: 틈은 IDLE_GAP_MS까지만 센다.
    s = record(s, T + 61_000, { kind: 'bullet', damage: 10, owner: 'boss', crit: false })
    expect(s.activeMs).toBe(1000 + IDLE_GAP_MS)
    expect(summarize(s, T + 61_000, cats).perSecond).toBeCloseTo(30 / 6)
    expect(summarize(null, T, cats).perSecond).toBe(0)
  })

  it('매도벽이 아닌 것을 맞힌 피해도 쏜 고양이에게 더하고 벽 피해와 나눠 보인다 (647번)', () => {
    let s: BattleStats | null = null
    s = record(s, T, { kind: 'bullet', damage: 30, owner: 'boss', crit: false })
    s = record(s, T + 100, { kind: 'bullet', damage: 50, owner: 'sky', crit: true, order: true })
    s = record(s, T + 200, { kind: 'bolt', damage: 20, owner: null, crit: false, order: true })
    s = record(s, T + 300, { kind: 'bullet', damage: 10, owner: 'night', crit: false })
    const sum = summarize(s, T + 300, cats)
    expect([sum.total, sum.wall, sum.orders]).toEqual([110, 40, 70])
    expect(sum.rows.map((r) => [r.code, r.damage, r.wall, r.skill])).toEqual([
      ['sky', 50, 0, 0],
      ['boss', 30, 30, 0],
      ['night', 30, 10, 20],
    ])
    expect(sum.skillShare).toBeCloseTo(20 / 110)
    expect([sum.shots, sum.crits, sum.best]).toEqual([3, 1, 50])
  })

  it('647번 전에 기기에 남은 통계는 버린다', () => {
    const old = { ...record(null, T, { kind: 'bullet', damage: 10, owner: 'boss', crit: false }) }
    delete (old as Partial<BattleStats>).orders
    expect(summarize(old, T, cats).total).toBe(0)
  })

  it('넘어간 벽을 이번 창에 더한다', () => {
    let s = addWalls(null, T, 2)
    s = addWalls(s, T + 1, 1)
    expect(summarize(s, T + 1, cats).walls).toBe(3)
    expect(summarize(s, T + STATS_WINDOW_MS, cats).walls).toBe(0)
  })

  it('피해는 벽처럼 주로, 만 단위로 끊어 적는다', () => {
    expect(sharesText(0)).toBe('0주')
    expect(sharesText(10)).toBe('1,500주')
    expect(sharesText(100)).toBe('1.5만주')
    expect(sharesText(1_000_000)).toBe('1.5억주')
    expect(sharesText(2e10)).toBe('3조주')
  })
})
