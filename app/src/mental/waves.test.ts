import { expect, it } from 'vitest'
import { ENEMIES } from './enemies'
import { PANIC_RUSH, panicRushGap, waveKind } from './waves'

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
