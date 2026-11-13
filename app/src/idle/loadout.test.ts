import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { idleLoadout } from './loadout'

const company = (owned: string[], bonus = 0) =>
  ({
    idle: {
      skills: ['water', 'meteor', 'bolt', 'ram'].map((code) => ({
        code,
        owned: owned.includes(code),
      })),
    },
    battleUpgrades: [{ kind: 'damage', bonusPercent: bonus }],
  }) as unknown as Company

describe('방치형 전투 획득 상태', () => {
  it('획득하지 않은 마법과 고양이는 전투에 나오지 않는다', () => {
    expect(idleLoadout(company([]))).toMatchObject({
      water: 0,
      meteor: 0,
      lightning: 0,
      earth: 0,
      mates: 0,
    })
  })
  it('획득한 능력만 기존 전투의 마법과 동료로 연결한다', () => {
    expect(idleLoadout(company(['water', 'meteor']))).toMatchObject({
      water: 1,
      meteor: 1,
      lightning: 0,
      earth: 0,
      mates: 1,
    })
    expect(idleLoadout(company(['water', 'meteor', 'bolt', 'ram']))).toMatchObject({
      water: 1,
      meteor: 1,
      lightning: 1,
      earth: 1,
      mates: 2,
    })
  })
  it('영구 강화가 무기 피해에 반영된다', () => {
    expect(idleLoadout(company([], 100)).damage).toBe(2 * idleLoadout(company([])).damage)
  })
})
