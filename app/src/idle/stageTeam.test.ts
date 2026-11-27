import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { idleLoadout } from './loadout'
import { stageLoadout, stageOrder } from './stageTeam'

describe('스테이지 공격력 강화', () => {
  const company = (bonusPercent: number, permanent?: number) =>
    ({
      battleUpgrades: [{ kind: 'damage', bonusPercent }],
      idle: {
        ...(permanent === undefined
          ? {}
          : {
              rebirth: { upgrades: [{ kind: 'damage', bonus: permanent }] },
            }),
        cats: [
          {
            code: 'sky',
            name: '하늘냥',
            level: 1,
            fielded: true,
            damagePercent: 50,
            firePercent: 100,
            criticalPercent: 100,
            skillLevel: 3,
            skills: [{ code: 'meteor', name: '메테오' }],
          },
        ],
      },
    }) as unknown as Company

  it('일반 공격력 강화는 사장냥과 출전 고양이의 스테이지 피해를 바꾸지 않는다', () => {
    const base = stageLoadout(company(0), ['sky'])
    expect(stageLoadout(company(9900), ['sky'])).toEqual(base)
    expect(stageLoadout(company(9900), []).damage).toBe(1)
    expect(base.mateGuns[0].damage).toBe(0.5)
    expect(idleLoadout(company(9900), ['sky']).mateGuns[0].damage).toBe(50)
  })

  it('영구 공격력 강화만 적용하며 일반 강화와 중복 계산하지 않는다', () => {
    const loadout = stageLoadout(company(19900, 100), ['sky'])
    expect(loadout.damage).toBe(2)
    expect(loadout.mateGuns[0].damage).toBe(1)
    expect(stageLoadout(company(100, 100), ['sky'])).toEqual(loadout)
    expect(stageLoadout(company(19900, 100), []).damage).toBe(2)
  })
})

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
