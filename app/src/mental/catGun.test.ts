import { describe, expect, it } from 'vitest'
import { CAT_GUN, CAT_SHOULDER_ANGLE, catGunAim, catGunPose, catShoulder } from './catGun'
import { CAT_SCALE } from './catModels'

describe('어깨와 두 손에 고정한 견착 자세', () => {
  it('체형·표적 방향·반동에 관계없이 견착 자세를 유지하고 실제 총구의 탄이 표적을 향한다', () => {
    for (const model of ['hero', 'fold', 'fluffy'] as const) {
      for (const target of [
        { x: 20, y: 100 },
        { x: 180, y: 100 },
        { x: 340, y: 100 },
        { x: 340, y: 550 },
      ]) {
        for (const kick of [0, 0.5, 1.5]) {
          const aim = catGunAim(model, 180, 600, target, kick)
          const pose = catGunPose(model, 180, 600, kick)
          expect(pose.angle).toBe(CAT_SHOULDER_ANGLE)
          expect(Math.hypot(pose.muzzle.x - pose.x, pose.muzzle.y - pose.y)).toBeCloseTo(
            CAT_GUN.barrel * CAT_SCALE,
          )
          const dx = target.x - pose.muzzle.x
          const dy = target.y - pose.muzzle.y
          expect(dx * Math.sin(aim) - dy * Math.cos(aim)).toBeCloseTo(0)
          expect(dx * Math.cos(aim) + dy * Math.sin(aim)).toBeGreaterThan(0)
        }
      }
    }
  })
  it('반동은 총열 반대 방향으로만 이동하고 몸의 기준점은 움직이지 않는다', () => {
    const angle = CAT_SHOULDER_ANGLE
    const rest = catGunPose('hero', 180, 600)
    const shot = catGunPose('hero', 180, 600, 1)
    expect({ x: rest.x, y: rest.y }).toEqual(catShoulder('hero', 180, 600))
    expect(shot.x - rest.x).toBeCloseTo(-Math.cos(angle) * 2.4)
    expect(shot.y - rest.y).toBeCloseTo(-Math.sin(angle) * 2.4)
    expect(shot.angle).toBe(rest.angle)
  })
})
