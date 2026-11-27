import { describe, expect, it } from 'vitest'
import { bossSeat, fieldedInOrder, fieldSeats, seatCount } from './seats'

const cat = (code: string, slot?: number | null, fielded = true) => ({ code, slot, fielded })

describe('출전 칸 (599번)', () => {
  it('고양이는 서버가 준 칸에 서고 사이의 빈 칸은 비워 둔다', () => {
    const seats = fieldSeats([cat('sky', 3), cat('mint', 1), cat('night', null, false)], 4)
    expect(seats.map((c) => c?.code ?? null)).toEqual([null, 'mint', null, 'sky'])
  })
  it('칸 번호가 없거나 겹치면 빈 칸 가운데 가장 앞에 세운다', () => {
    const seats = fieldSeats([cat('sky'), cat('mint', 0), cat('lilac', 0)], 4)
    expect(seats.map((c) => c?.code ?? null)).toEqual(['mint', 'sky', 'lilac', null])
  })
  it('전투의 줄은 칸 번호순이다', () => {
    const order = fieldedInOrder([
      cat('sky', 3),
      cat('mint', 1),
      cat('night', 0, false),
      cat('lilac', 2),
    ])
    expect(order.map((c) => c.code)).toEqual(['mint', 'lilac', 'sky'])
  })

  it('사장냥이 선 칸은 비워 두고, 칸 번호가 없는 고양이는 그 다음 빈 칸에 선다 (704번)', () => {
    const seats = fieldSeats([cat('sky', 0), cat('mint')], 5, 0)
    expect(seats.map((c) => c?.code ?? null)).toEqual([null, 'sky', 'mint', null, null])
    expect(seatCount({ fieldSlots: 4 })).toBe(5)
    expect(bossSeat({ bossFielded: true, bossSlot: 3 })).toBe(3)
    expect(bossSeat({ bossFielded: false, bossSlot: null })).toBeNull()
    expect(bossSeat({ bossFielded: true })).toBe(0)
  })
})
