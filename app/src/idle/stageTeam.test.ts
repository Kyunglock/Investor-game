import { describe, expect, it } from 'vitest'
import { stageOrder } from './stageTeam'

describe('스테이지에서 고양이가 나오는 차례 (695번)', () => {
  const team = ['night', 'sky', 'mint', 'lilac']

  it('출전한 고양이를 빠짐없이 섞고 원래 목록은 건드리지 않는다', () => {
    for (let i = 0; i < 20; i++) expect([...stageOrder(team)].sort()).toEqual([...team].sort())
    expect(team).toEqual(['night', 'sky', 'mint', 'lilac'])
    expect(stageOrder([])).toEqual([])
    expect(stageOrder(['sky'])).toEqual(['sky'])
  })

  it('출전 칸의 차례를 따르지 않는다: 어느 고양이든 먼저 나올 수 있다', () => {
    // rand가 0이면 매번 맨 앞과 바꿔 한 칸씩 밀리고, 1에 가까우면 제자리다.
    expect(stageOrder(team, () => 0)).toEqual(['sky', 'mint', 'lilac', 'night'])
    expect(stageOrder(team, () => 0.999)).toEqual(team)
    expect(stageOrder(team, () => 1)).toEqual(team)
    const firsts = new Set(Array.from({ length: 200 }, () => stageOrder(team)[0]))
    expect(firsts.size).toBe(team.length)
  })
})
