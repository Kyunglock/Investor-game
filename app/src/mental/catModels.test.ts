import { describe, expect, it } from 'vitest'
import { catAim, catMuzzle, mateModel } from './catModels'

describe('실제 총구 기준 조준', () => {
  it('사장냥과 모든 동료의 탄 궤적이 좌우·중앙·가까운 표적을 지난다', () => {
    for (const model of ['hero', mateModel(0), mateModel(1), mateModel(2)] as const) {
      const muzzle = catMuzzle(model, 180, 600)
      for (const target of [
        { x: 20, y: 200 },
        { x: 340, y: 200 },
        { x: 180, y: 200 },
        { x: 20, y: 540 },
        { x: 340, y: 540 },
      ]) {
        const aim = catAim(model, 180, 600, target)
        const distance = Math.hypot(target.x - muzzle.x, target.y - muzzle.y)
        expect(muzzle.x + Math.cos(aim) * distance).toBeCloseTo(target.x)
        expect(muzzle.y + Math.sin(aim) * distance).toBeCloseTo(target.y)
      }
    }
  })

  it('왼쪽에서 오른쪽으로 표적이 바뀌면 새 표적의 방향을 바로 계산한다', () => {
    const left = catAim('hero', 180, 600, { x: 20, y: 400 })
    const right = catAim('hero', 180, 600, { x: 340, y: 400 })
    expect(Math.cos(left)).toBeLessThan(0)
    expect(Math.cos(right)).toBeGreaterThan(0)
    expect(Math.sin(left)).toBeLessThan(0)
    expect(Math.sin(right)).toBeLessThan(0)
  })
})
