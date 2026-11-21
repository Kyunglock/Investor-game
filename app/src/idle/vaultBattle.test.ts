import { describe, expect, it } from 'vitest'
import { nextVaultWeek, vaultEncounter, vaultWeek } from './vaultBattle'

describe('금고 도전', () => {
  it('한국 시간 월요일 자정에 다음 주 금고를 연다', () => {
    const monday = Date.parse('2026-11-23T00:00:00+09:00')
    expect(nextVaultWeek(vaultWeek(monday - 1))).toBe(monday)
    expect(vaultWeek(monday)).toBe(vaultWeek(monday - 1) + 1)
  })
  it('보스는 첫 벽에서, 주간 수호자는 층별 매도벽 뒤에서 싸운다', () => {
    expect(vaultEncounter(true, 1, 100).walls.map((w) => w.boss)).toEqual([true])
    for (const floor of [1, 2, 3]) {
      const spec = vaultEncounter(false, floor, 100)
      expect(spec.walls).toHaveLength(floor + 1)
      expect(spec.walls.at(-1)?.boss).toBe(true)
      expect(spec.walls.filter((w) => w.boss)).toHaveLength(1)
    }
  })
})
