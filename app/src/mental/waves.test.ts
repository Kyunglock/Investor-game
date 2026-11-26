import { expect, it } from 'vitest'
import { ARENA_MAPS } from './arenaMaps'
import { ENEMIES } from './enemies'
import {
  IDLE_RAID,
  IDLE_RAID_BANNERS,
  IDLE_RAID_ORDER,
  idleRaidGap,
  idleRaidKind,
  PANIC_RUSH,
  panicRushGap,
  STAGE_WAVE,
  waveCrowd,
  waveCurve,
  waveKind,
  waveProgress,
  waveStreamCount,
  waveStreamKind,
  waveStreamReward,
  waveXp,
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

it('웨이브 판 (690번): 난이도 곡선은 첫 웨이브에서 시작해 마지막 웨이브에 끝에 닿는다', () => {
  expect(waveProgress(1, 10)).toBe(0)
  expect(waveProgress(10, 10)).toBe(1)
  expect(waveProgress(0, 10)).toBe(0)
  expect(waveProgress(1, 1)).toBe(1)
  expect(waveCurve(1, 15)).toBe(0)
  expect(waveCurve(15, 15)).toBe(240)
  // 웨이브 수가 달라도 끝은 같은 세기다.
  expect(waveCurve(10, 10)).toBe(waveCurve(15, 15))
})

it('웨이브 판 (690번): 줄기의 몬스터는 뒤 웨이브일수록, 적 수 배율이 클수록 많다', () => {
  // 시간 판의 생성 간격(700ms → 200ms)으로 pour초 동안 나오던 만큼.
  expect(waveStreamCount(1, 10, 1)).toBe(Math.round((STAGE_WAVE.pour * 1000) / 700))
  expect(waveStreamCount(10, 10, 1)).toBe(Math.round((STAGE_WAVE.pour * 1000) / 200))
  expect(waveStreamCount(10, 10, 2)).toBe(2 * waveStreamCount(10, 10, 1))
  const counts = Array.from({ length: 10 }, (_, i) => waveStreamCount(i + 1, 10, 2))
  for (let i = 1; i < counts.length; i++) {
    expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
  }
  expect(waveStreamCount(1, 10, 0)).toBeGreaterThanOrEqual(1)
})

it('웨이브 판의 경험치 (694번): 웨이브 하나를 다 물리치면 한 번에서 한 번 반 레벨이 오른다', () => {
  expect(STAGE_WAVE.levels).toBeGreaterThanOrEqual(1)
  expect(STAGE_WAVE.levels).toBeLessThanOrEqual(1.5)
  // 몬스터가 많든 적든, 레벨이 높든 낮든 웨이브 하나의 몫은 같다.
  for (const [count, needed] of [
    [20, 105],
    [160, 6000],
  ]) {
    const waveReward = count * 25
    let xp = 0
    for (let i = 0; i < count; i++) xp += waveXp(25, waveReward, needed)
    expect(xp / needed).toBeCloseTo(STAGE_WAVE.levels)
  }
  // 값이 큰 몬스터가 더 많이 준다. 웨이브의 값을 모르면 주지 않는다.
  expect(waveXp(80, 1000, 500)).toBeGreaterThan(waveXp(10, 1000, 500))
  expect(waveXp(80, 0, 500)).toBe(0)
})

it('첫 세 웨이브는 몬스터가 덜 나오고 넷째 웨이브부터는 그대로다 (695번)', () => {
  const crowds = [1, 2, 3].map(waveCrowd)
  expect(crowds).toEqual([...crowds].sort((a, b) => a - b))
  for (const crowd of crowds) {
    expect(crowd).toBeLessThan(1)
    expect(crowd).toBeGreaterThanOrEqual(0.5)
  }
  expect(waveCrowd(4)).toBe(1)
  expect(waveCrowd(15)).toBe(1)
  expect(waveCrowd(0)).toBe(1)
})

it('모든 전장의 줄기와 경험치가 그 전장에 편성된 세 몹만 쓴다', () => {
  for (const { roster } of ARENA_MAPS) {
    expect(new Set(roster).size).toBe(3)
    expect([0, 0.59, 0.6, 0.849, 0.85, 1].map((r) => waveStreamKind(r, roster))).toEqual([
      roster[0],
      roster[0],
      roster[1],
      roster[1],
      roster[2],
      roster[2],
    ])
    expect(waveStreamReward(roster)).toBeCloseTo(
      ENEMIES[roster[0]].reward * 0.6 +
        ENEMIES[roster[1]].reward * 0.25 +
        ENEMIES[roster[2]].reward * 0.15,
    )
  }
})
