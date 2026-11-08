import type { Company } from '@web/api/client'

export type Weapon = NonNullable<Company['weapons']>[number]

/** 싸우는 건 사장냥(플레이어 본인, decisions.md 341번). 이름과 든 무기(346번). */
export interface Hero {
  name: string
  /** 든 무기. 무기 전에 차린 회사라 목록이 비어 있으면 일반 권총. */
  weapon: Weapon
}

export const DEFAULT_WEAPON: Weapon = {
  kind: 'pistol',
  name: '권총',
  grade: 'N',
  gradeName: '일반',
  damagePercent: 100,
  fireMs: 260,
  power: 0,
  bulletSpeed: 720,
  equipped: true,
}

export function heroOf(company: Company): Hero {
  const weapon = (company.weapons ?? []).find((w) => w.equipped) ?? DEFAULT_WEAPON
  return { name: '사장냥', weapon }
}
