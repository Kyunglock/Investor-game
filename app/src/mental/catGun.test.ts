import { describe, expect, it } from 'vitest'
import { CAT_GUN, catGunAim, catGunPose, catShotAngle } from './catGun'
import { CAT_SCALE } from './catModels'
import { CAT_POSE_DEGREES, catPoseAngle, catPoseIndex } from './catPose'

describe('9방향 견착과 총구', () => {
  it('화면 위를 기준으로 15도 간격의 자세를 선택한다', () => {
    for (const [index, degrees] of CAT_POSE_DEGREES.entries()) {
      for (const offset of [-7, 0, 7]) {
        const angle = ((degrees + offset - 90) * Math.PI) / 180
        expect(catPoseIndex(angle)).toBe(index)
        expect(catPoseIndex(angle + Math.PI * 2)).toBe(index)
        expect(catPoseIndex(angle - Math.PI * 2)).toBe(index)
      }
    }
  })

  it('좌우 90도와 뒤쪽 표적도 ±60도 그림으로 제한한다', () => {
    expect(catPoseIndex(-Math.PI)).toBe(0)
    expect(catPoseIndex(0)).toBe(8)
    for (let i = 0; i < 360; i++) {
      const pose = catGunPose('hero', 180, 600, (i * Math.PI) / 180)
      expect(pose.angle).toBeGreaterThanOrEqual((-150 * Math.PI) / 180)
      expect(pose.angle).toBeLessThanOrEqual((-30 * Math.PI) / 180)
      expect(pose.angle).toBe(catPoseAngle(pose.index))
    }
  })

  it('모든 체형·방향·반동에서 탄은 실제 총구에서 표적까지 향한다', () => {
    for (const model of ['hero', 'fold', 'fluffy'] as const) {
      for (let degrees = 0; degrees < 360; degrees += 13) {
        const angle = (degrees * Math.PI) / 180
        const target = { x: 180 + Math.cos(angle) * 200, y: 600 + Math.sin(angle) * 200 }
        const aim = catGunAim(model, 180, 600, target)
        for (const kick of [0, 0.5, 1.5]) {
          const pose = catGunPose(model, 180, 600, aim, kick)
          expect(Math.hypot(pose.muzzle.x - pose.x, pose.muzzle.y - pose.y)).toBeCloseTo(
            CAT_GUN.barrel * CAT_SCALE,
          )
          const shot = catShotAngle(pose.muzzle, target)
          const dx = target.x - pose.muzzle.x
          const dy = target.y - pose.muzzle.y
          expect(dx * Math.sin(shot) - dy * Math.cos(shot)).toBeCloseTo(0)
          expect(dx * Math.cos(shot) + dy * Math.sin(shot)).toBeGreaterThan(0)
        }
      }
    }
  })

  it('반동은 선택한 총열 반대 방향으로만 이동한다', () => {
    for (const index of CAT_POSE_DEGREES.keys()) {
      const angle = catPoseAngle(index)
      const rest = catGunPose('hero', 180, 600, angle)
      const shot = catGunPose('hero', 180, 600, angle, 1)
      expect(shot.x - rest.x).toBeCloseTo(-Math.cos(angle) * 2.4)
      expect(shot.y - rest.y).toBeCloseTo(-Math.sin(angle) * 2.4)
      expect(shot.index).toBe(rest.index)
    }
  })
})
