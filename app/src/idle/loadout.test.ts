import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { idleLoadout } from './loadout'

type Cat = {
  code: string
  fielded: boolean
  damagePercent?: number
  firePercent?: number
  criticalPercent?: number
  weapon?: object | null
}

const company = (owned: string[], cats: Cat[] = [], bonus = 0) =>
  ({
    idle: {
      skills: ['water', 'meteor', 'bolt', 'ram'].map((code) => ({
        code,
        owned: owned.includes(code),
      })),
      cats: cats.map((cat) => ({
        damagePercent: 50,
        firePercent: 100,
        criticalPercent: 100,
        weapon: null,
        ...cat,
      })),
    },
    weapons: [
      { kind: 'pistol', grade: 'F', damagePercent: 100, fireMs: 260, power: 0, bulletSpeed: 720 },
      { kind: 'rifle', grade: 'S', damagePercent: 400, fireMs: 520, power: 1, bulletSpeed: 900 },
    ].map((w, i) => ({ ...w, equipped: i === 0 })),
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
      mateGuns: [],
    })
  })
  it('스킬은 고양이와 상관없이, 고양이는 출전한 만큼만 전투에 연결한다 (488·491번)', () => {
    expect(
      idleLoadout(
        company(
          ['water', 'meteor'],
          [
            { code: 'sky', fielded: true },
            { code: 'mint', fielded: false },
          ],
        ),
      ),
    ).toMatchObject({ water: 1, meteor: 1, lightning: 0, earth: 0, mates: 1 })
    expect(idleLoadout(company(['water', 'meteor', 'bolt', 'ram']))).toMatchObject({
      water: 1,
      meteor: 1,
      lightning: 1,
      earth: 1,
      mates: 0,
    })
  })
  it('영구 강화가 무기 피해에 반영된다', () => {
    expect(idleLoadout(company([], [], 100)).damage).toBe(2 * idleLoadout(company([])).damage)
  })
  it('고양이는 제가 든 총을 제 화력·특성으로 쏘고, 총이 없으면 기본 권총을 쏜다 (488·492번)', () => {
    const loadout = idleLoadout(
      company(
        [],
        [
          {
            code: 'mint',
            fielded: true,
            damagePercent: 75,
            weapon: { kind: 'rifle', grade: 'S' },
          },
          { code: 'sky', fielded: true, firePercent: 125 },
          { code: 'lilac', fielded: false, criticalPercent: 150 },
        ],
        50,
      ),
    )
    expect(loadout.mateGuns).toEqual([
      {
        kind: 'rifle',
        grade: 'S',
        damage: 4 * 1.5 * 0.75,
        bulletPower: 1,
        fireMs: 520,
        bulletSpeed: 900,
        critical: 1,
        look: 1,
      },
      {
        kind: 'pistol',
        grade: 'F',
        damage: 1.5 * 0.5,
        bulletPower: 0,
        fireMs: 260 / 1.25,
        bulletSpeed: 720,
        critical: 1,
        look: 0,
      },
    ])
  })
})
