import { describe, expect, it } from 'vitest'
import { clashSwings } from './TeamClash'

describe('"너희가 알아서 해" 맞붙는 장면 (decisions.md 284번)', () => {
  it('경계선이 좌우로 크게 엎치락뒤치락하다가 이길 쪽으로 쏠린다', () => {
    const swings = clashSwings(45, 65, false)
    expect(swings.length).toBeGreaterThanOrEqual(8)
    for (const s of swings) {
      expect(s).toBeGreaterThanOrEqual(12)
      expect(s).toBeLessThanOrEqual(88)
    }
    // 처음 두 번은 서로 반대쪽으로 크게 밀린다.
    expect(Math.sign(swings[0] - 50)).not.toBe(Math.sign(swings[1] - 50))
    expect(Math.abs(swings[0] - swings[1])).toBeGreaterThan(25)
    // 끝 무렵에는 매도(이긴 쪽, 매수 몫이 작다)로 기운다.
    const tail = swings.slice(-2)
    expect((tail[0] + tail[1]) / 2).toBeLessThan(50)
    const buyWin = clashSwings(80, 20, true).slice(-2)
    expect((buyWin[0] + buyWin[1]) / 2).toBeGreaterThan(50)
  })
})
