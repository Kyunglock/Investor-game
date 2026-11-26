import { describe, expect, it } from 'vitest'
import { arenaMap, stageArenaMap } from './arenaMaps'

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
    [201, 'glasshouse'],
    [250, 'glasshouse'],
    [251, 'moonlit-harbor'],
    [301, 'toy-city'],
    [401, 'candy-factory'],
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

it('번호 스테이지를 다시 플레이해도 같은 전장이며 여섯 판마다 순환한다', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 2].map((stage) => stageArenaMap(stage).key)).toEqual([
    'toy-city',
    'neon-street',
    'candy-factory',
    'space-station',
    'glasshouse',
    'moonlit-harbor',
    'toy-city',
    'neon-street',
  ])
})
