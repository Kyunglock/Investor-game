import { describe, expect, it } from 'vitest'
import { ENEMIES, type EnemyKind } from './enemies'
import { WALK_FRAMES, walkFrame, walkPose } from './enemyWalk'

describe('적의 걸음 주기', () => {
  it('모든 적이 두 발을 번갈아 내딛고 원래 자세로 돌아온다', () => {
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const left = walkPose(kind, 2)
      const right = walkPose(kind, 6)
      expect(left.leftFoot).toBeGreaterThan(0)
      expect(left.rightFoot).toBeLessThan(0)
      expect(right.leftFoot).toBeLessThan(0)
      expect(right.rightFoot).toBeGreaterThan(0)
      expect(walkPose(kind, WALK_FRAMES)).toEqual(walkPose(kind, 0))
    }
  })

  it('개체별 시작 발을 유지하며 모션 줄이기에서는 정지 자세를 쓴다', () => {
    expect(walkFrame('panic', 48 / ENEMIES.panic.speed, 4)).toBe(4)
    expect(walkFrame('panic', 0, 4)).toBe(4)
    for (let ms = 0; ms < 10000; ms += 17) {
      expect(walkFrame('spec', ms / 1000, 7)).toBeGreaterThanOrEqual(0)
      expect(walkFrame('spec', ms / 1000, 7)).toBeLessThan(WALK_FRAMES)
      expect(walkFrame('panic', ms / 1000, 7, true)).toBe(0)
    }
  })
})
