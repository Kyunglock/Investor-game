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
    [301, 'pearl-aquarium'],
    [351, 'star-observatory'],
    [401, 'snow-rink'],
    [451, 'toy-city'],
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

it('아홉 번째 전장 뒤에 첫 전장으로 돌아간다', () => {
  expect(Array.from({ length: 10 }, (_, i) => stageArenaMap(i + 1).key)).toEqual([
    'toy-city',
    'neon-street',
    'candy-factory',
    'space-station',
    'glasshouse',
    'moonlit-harbor',
    'pearl-aquarium',
    'star-observatory',
    'snow-rink',
    'toy-city',
  ])
})
