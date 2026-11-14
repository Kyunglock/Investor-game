import { expect, it } from 'vitest'
import { ENEMIES } from './enemies'
import {
  IDLE_RAID,
  IDLE_RAID_BANNERS,
  IDLE_RAID_ORDER,
  idleRaidGap,
  idleRaidKind,
  PANIC_RUSH,
  panicRushGap,
  waveKind,
} from './waves'

it('패닉셀·투매·공매도 순서로 반복하고 공매도는 느리고 단단하다', () => {
  expect(Array.from({ length: 6 }, (_, i) => waveKind(i))).toEqual([
    'panic',
    'dump',
    'short',
    'panic',
    'dump',
    'short',
  ])
  expect(ENEMIES.short.hp).toBeGreaterThan(ENEMIES.dump.hp)
  expect(ENEMIES.short.speed).toBeLessThan(ENEMIES.dump.speed)
})

it('패닉셀 러시는 22~34초 간격으로 판 중간중간 온다', () => {
  expect(panicRushGap(0)).toBe(PANIC_RUSH.minGap)
  expect(panicRushGap(1)).toBe(PANIC_RUSH.maxGap)
  expect(panicRushGap(0.5)).toBe(28)
  expect(panicRushGap(-1)).toBe(PANIC_RUSH.minGap)
  expect(PANIC_RUSH.first).toBeGreaterThan(0)
})

it('자동 전투의 몬스터는 이따금 한 떼씩, 종류를 돌아가며 온다 (500번)', () => {
  expect(IDLE_RAID_ORDER.map((_, i) => idleRaidKind(i))).toEqual(['panic', 'dump', 'short', 'spec'])
  expect(idleRaidKind(4)).toBe('panic')
  // 습격 사이는 45초 넘게 조용하다.
  expect(idleRaidGap(0)).toBe(IDLE_RAID.minGap)
  expect(idleRaidGap(1)).toBe(IDLE_RAID.maxGap)
  expect(IDLE_RAID.minGap).toBeGreaterThanOrEqual(45)
  expect(IDLE_RAID_BANNERS.panic[0]).toBe('패닉셀이 몰려온다!!')
  for (const kind of IDLE_RAID_ORDER) expect(IDLE_RAID_BANNERS[kind][0]).not.toBe('')
})
