import { describe, expect, it } from 'vitest'
import {
  IDLE_PIERCE,
  IDLE_PIERCE_FLOOR,
  idleBossWall,
  idlePierceHits,
  idlePierceReach,
} from './idlePierce'

describe('매도벽 돌파의 총알 관통 (520번)', () => {
  const walls = [
    { wall: 8, hp: 100 },
    { wall: 9, hp: 100 },
  ]

  it('관통 3: 맨 앞 벽 100%, 다음 벽 50%, 그다음 벽 25% (서버 IdleEngine.PIERCE와 같다)', () => {
    expect(IDLE_PIERCE).toEqual([1, 0.5, 0.25])
    expect(idlePierceHits(7, 40, walls)).toEqual([
      { wall: 8, behind: 1, damage: 20 },
      { wall: 9, behind: 2, damage: 10 },
    ])
  })

  it('세 번째 벽 뒤로는 가지 않는다', () => {
    const many = [...walls, { wall: 10, hp: 100 }, { wall: 11, hp: 100 }]
    expect(idlePierceHits(7, 40, many).map((hit) => hit.wall)).toEqual([8, 9])
  })

  it('뒤 벽은 체력 1을 남긴다: 바닥까지 깎인 벽은 더 맞지 않고, 그 뒤 벽의 비율은 그대로다', () => {
    const worn = [
      { wall: 8, hp: IDLE_PIERCE_FLOOR },
      { wall: 9, hp: 30 },
    ]
    expect(idlePierceHits(7, 40, worn)).toEqual([{ wall: 9, behind: 2, damage: 10 }])
  })

  it('뒤에 벽이 보이지 않으면(다른 벽 번호·없음) 맞지 않는다', () => {
    expect(idlePierceHits(7, 40, [])).toEqual([])
    expect(idlePierceHits(20, 40, walls)).toEqual([])
  })

  it('피해가 없으면 뚫지 않는다', () => {
    expect(idlePierceHits(7, 0, walls)).toEqual([])
    expect(idlePierceHits(7, Number.NaN, walls)).toEqual([])
  })

  it('대량 매도벽(열 번째 벽마다)은 뚫리지 않는다: 맨 앞이면 멈추고, 뒤에 있으면 그 앞까지만 간다', () => {
    expect(idleBossWall(10)).toBe(true)
    expect(idleBossWall(11)).toBe(false)
    expect(idlePierceReach(7)).toBe(2)
    expect(idlePierceReach(8)).toBe(1)
    expect(idlePierceReach(9)).toBe(0)
    expect(idlePierceReach(10)).toBe(0)
    const near = [
      { wall: 9, hp: 100 },
      { wall: 10, hp: 100 },
    ]
    expect(idlePierceHits(8, 40, near)).toEqual([{ wall: 9, behind: 1, damage: 20 }])
    expect(idlePierceHits(9, 40, [{ wall: 10, hp: 100 }])).toEqual([])
    expect(idlePierceHits(10, 40, [{ wall: 11, hp: 100 }])).toEqual([])
  })
})
