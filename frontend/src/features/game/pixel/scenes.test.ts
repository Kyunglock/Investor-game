import { describe, expect, it } from 'vitest'
import { SCENES, sceneFor } from './scenes'

describe('sceneFor', () => {
  it('나이·단계·직업으로 장면을 고른다 (설계 8절)', () => {
    expect(sceneFor('baby', 'CHILDHOOD', false)).toBe('nursery')
    expect(sceneFor('child', 'CHILDHOOD', false)).toBe('school')
    expect(sceneFor('adult', 'CHILDHOOD', false)).toBe('street')
    expect(sceneFor('adult', 'SAVING', true)).toBe('office')
    expect(sceneFor('adult', 'INVESTING', true)).toBe('studio')
    expect(sceneFor('middle', 'INVESTING', true)).toBe('studio-middle')
    expect(sceneFor('middle', 'SAVING', true)).toBe('studio-middle')
    expect(sceneFor('old', 'ENDED', true)).toBe('home-old')
    expect(sceneFor('old', 'INVESTING', true)).toBe('home-old')
  })
})

describe('SCENES', () => {
  it('모든 장면은 64열 20행이고 캐릭터 발 위치가 격자 안에 있다', () => {
    for (const [key, scene] of Object.entries(SCENES)) {
      expect(scene.map, key).toHaveLength(20)
      for (const row of scene.map) {
        expect(row, key).toHaveLength(64)
      }
      expect(scene.anchor.x, key).toBeGreaterThanOrEqual(0)
      expect(scene.anchor.x + 16, key).toBeLessThanOrEqual(64)
      expect(scene.anchor.y, key).toBe(20)
      expect(scene.caption, key).toMatch(/^서울 · /)
    }
  })
})
