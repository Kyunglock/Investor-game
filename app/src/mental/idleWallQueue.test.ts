import { describe, expect, it } from 'vitest'
import { queuedWallHealth, queuedWallLabel } from './idleWallQueue'

const wall = (n: number, hp: number, maxHp: number) => ({ wall: n, hp, maxHp })

describe('뒤 벽의 체력', () => {
  it('받은 값에서 그 벽을 찾는다', () => {
    expect(queuedWallHealth(3, [wall(2, 5, 16), wall(3, 20, 22)])).toEqual(wall(3, 20, 22))
  })

  it('앞 벽이 부서진 프레임에는 스냅샷의 맨 앞 벽이 화면의 다음 벽이다', () => {
    // 화면은 아직 벽 1 앞인데 스냅샷은 벽 2로 넘어갔다: 벽 2의 체력은 스냅샷의 맨 앞 벽 값이다.
    const snapshot = [wall(2, 16.1, 16.1), wall(3, 22.4, 22.4), wall(4, 28.9, 28.9)]
    const health = queuedWallHealth(2, snapshot)
    expect(health).toEqual(wall(2, 16.1, 16.1))
    expect(queuedWallLabel(health?.maxHp ?? 0, health?.hp ?? 0)).toBe('2,400주')
  })

  it('받은 값에 없으면 이미 그리던 값을 그대로 둔다', () => {
    expect(queuedWallHealth(2, [wall(5, 40, 40)], [wall(2, 9, 16), wall(3, 22, 22)])).toEqual(
      wall(2, 9, 16),
    )
  })

  it('모르는 벽의 체력은 지어내지 않는다', () => {
    expect(queuedWallHealth(2, [wall(5, 40, 40)], [wall(0, 0, 0), wall(3, 22, 22)])).toBeUndefined()
    expect(queuedWallHealth(2, [])).toBeUndefined()
  })
})
