import { expect, it } from 'vitest'
import { ENEMIES } from './enemies'
import { waveKind } from './waves'

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
