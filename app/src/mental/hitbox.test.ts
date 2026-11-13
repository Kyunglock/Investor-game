import { describe, expect, it } from 'vitest'
import { BULLET_VISUAL_SCALE, GRADE_FIRE } from './weaponVisuals'
import { BULLET_H, BULLET_R, BULLET_W, bulletHitbox } from './hitbox'

describe('탄 충돌 원', () => {
  it('어느 배율로 구웠든 원의 가운데는 그림의 가운데다', () => {
    for (const k of [1, 1.5, 2, 3]) {
      const w = BULLET_W * k
      const h = BULLET_H * k
      const { radius, ox, oy } = bulletHitbox(w, h)
      expect(ox + radius).toBeCloseTo(w / 2)
      expect(oy + radius).toBeCloseTo(h / 2)
      expect(radius).toBeCloseTo(BULLET_R * k)
    }
  })

  it('탄 그림을 늘리거나 줄여도 강화된 판정 반지름과 중앙 위치를 유지한다', () => {
    for (const k of [1, 1.5, 2, 3]) {
      for (const stretch of [0.56, 0.77, 0.84, 0.945, 1.05, 1.12]) {
        const w = BULLET_W * k
        const h = BULLET_H * k
        const { radius, ox, oy } = bulletHitbox(w, h, stretch)
        expect((radius * stretch) / k).toBeCloseTo(12)
        expect(ox + radius).toBeCloseTo(w / 2)
        expect(oy + radius).toBeCloseTo(h / 2)
      }
    }
  })
})

it('시인성 확대는 모든 무기 등급의 충돌 크기와 중심을 바꾸지 않는다', () => {
  for (const style of Object.values(GRADE_FIRE)) {
    for (const scale of [1, 1.5, 2]) {
      const before = bulletHitbox(64, 20, style.length * 0.7)
      const after = bulletHitbox(64, 20, style.length * 0.7 * BULLET_VISUAL_SCALE)
      const sx = (scale * style.length * 0.7) / 2
      const sy = (scale * style.width * 0.7) / 2
      expect(after.radius * sx * BULLET_VISUAL_SCALE).toBeCloseTo(before.radius * sx)
      expect(after.radius * sy * BULLET_VISUAL_SCALE).toBeCloseTo(before.radius * sy)
      expect(after.ox + after.radius).toBe(32)
      expect(after.oy + after.radius).toBe(10)
    }
  }
})
