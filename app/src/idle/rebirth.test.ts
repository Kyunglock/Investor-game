import { describe, expect, it } from 'vitest'
import { rebirthBlock } from './rebirth'

describe('환생 (571번)', () => {
  it('첫 보스를 깨기 전에는 언제부터 되는지 알린다', () => {
    expect(
      rebirthBlock({ count: 0, fish: 0, gain: 0, fromWall: 51, adGain: 0, upgrades: [] }),
    ).toBe('매도벽 51부터 환생할 수 있어요')
  })

  it('받을 생선이 있으면 환생할 수 있다', () => {
    expect(
      rebirthBlock({ count: 2, fish: 30, gain: 20, fromWall: 51, adGain: 60, upgrades: [] }),
    ).toBeNull()
  })
})
