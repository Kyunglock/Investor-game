import type { Company } from '@web/api/client'

export type Weapon = NonNullable<Company['weapons']>[number]
export type BattleUpgrade = NonNullable<Company['battleUpgrades']>[number]

/** 싸우는 건 사장냥(플레이어 본인, decisions.md 341번). 이름과 든 무기(346번), 자본으로 산 전투 강화(367번). */
export interface Hero {
  name: string
  /** 든 무기. 무기 전에 차린 회사라 목록이 비어 있으면 일반 권총. */
  weapon: Weapon
  upgrades: BattleUpgrade[]
}

export const DEFAULT_WEAPON: Weapon = {
  kind: 'pistol',
  name: '권총',
  grade: 'F',
  gradeName: 'F',
  damagePercent: 100,
  fireMs: 260,
  power: 0,
  bulletSpeed: 720,
  equipped: true,
  count: 1,
}

/** 기본 권총의 공격력: 무기 공격력은 이 값에 무기의 공격력 비율(damagePercent)을 곱한 수다. */
export const BASE_ATTACK = 100

/** 무기 공격력 (기본 권총 100): 무기의 비율에 강화 %가 그 위로 곱해진다. */
export function attackOf(weapon: { damagePercent: number }, bonusPercent = 0) {
  return Math.round(((BASE_ATTACK * weapon.damagePercent) / 100) * (1 + bonusPercent / 100))
}

export function heroOf(company: Company): Hero {
  const weapon = (company.weapons ?? []).find((w) => w.equipped) ?? DEFAULT_WEAPON
  return { name: '사장냥', weapon, upgrades: company.battleUpgrades ?? [] }
}
