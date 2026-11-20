import { describe, expect, it } from 'vitest'
import { enterVault, heavyStrike, nextVaultWeek, playTurn, vaultWeek } from './vaultBattle'

describe('금고 도전', () => {
  it('한국 시간 월요일 자정에 다음 주 금고를 연다', () => {
    const monday = Date.parse('2026-11-23T00:00:00+09:00')
    expect(nextVaultWeek(vaultWeek(monday - 1))).toBe(monday)
    expect(vaultWeek(monday)).toBe(vaultWeek(monday - 1) + 1)
  })
  it('강타를 막고 반격하면 모든 층과 보스를 격파한다', () => {
    for (const hp of [49, 61, 73, 86]) {
      for (const pattern of [0, 1, 2]) {
        let fight = enterVault(hp, pattern)
        while (fight.hp && fight.enemy) fight = playTurn(fight, heavyStrike(fight))
        expect(fight.enemy).toBe(0)
        expect(playTurn(fight, false)).toBe(fight)
      }
    }
  })
  it('강타를 계속 맞으면 패배한다', () => {
    let fight = enterVault(86, 0)
    while (fight.hp && fight.enemy) fight = playTurn(fight, false)
    expect(fight.hp).toBe(0)
  })
})
