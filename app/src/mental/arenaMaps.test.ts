import { describe, expect, it } from 'vitest'
import { arenaMap } from './arenaMaps'

describe('매도벽 배경 순환', () => {
  it.each([
    [1, 'toy-city'],
    [50, 'toy-city'],
    [51, 'neon-street'],
    [100, 'neon-street'],
    [101, 'candy-factory'],
    [150, 'candy-factory'],
    [151, 'space-station'],
    [200, 'space-station'],
    [201, 'toy-city'],
    [250, 'toy-city'],
    [251, 'neon-street'],
    [401, 'toy-city'],
  ])('%i벽에서는 %s 배경이다', (wall, key) => {
    expect(arenaMap(wall).key).toBe(key)
  })

  it('진행 번호를 다시 불러오면 해당 맵으로 돌아온다', () => {
    expect([49, 50, 51, 41, 51].map((wall) => arenaMap(wall).key)).toEqual([
      'toy-city',
      'toy-city',
      'neon-street',
      'toy-city',
      'neon-street',
    ])
  })
})
