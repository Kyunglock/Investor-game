import type { Company } from '@web/api/client'
import { loadoutOf } from '../mental/cards'
import { DEFAULT_WEAPON, heroOf } from '../mental/hero'

/** 고양이마다 전투 그림이 정해져 있다 (mates.ts MATE_LOOKS의 차례, 492번). */
export const CAT_LOOKS = { sky: 0, mint: 1, lilac: 2, sunset: 3, night: 4, snow: 5 } as const

/** 서버의 스킬 코드 → 전투의 마법. */
const SKILL_MAGIC = { water: 'water', meteor: 'meteor', bolt: 'lightning', ram: 'earth' } as const

export function idleLoadout(company: Company) {
  const hero = heroOf(company)
  const loadout = loadoutOf(hero.weapon, hero.upgrades)
  // 스킬은 고양이의 고유 능력이다 (501번): 출전한 고양이가 제 총을 쏘고 제 스킬 하나를 쓴다. 총이 없으면 기본 권총이다(서버 IdleEngine과 같다).
  const cats = company.idle?.cats.filter((cat) => cat.fielded) ?? []
  loadout.mateMagic = cats.map((cat) => SKILL_MAGIC[cat.skill])
  for (const magic of loadout.mateMagic) loadout[magic] = 1
  loadout.mates = cats.length
  loadout.mateGuns = cats.map((cat) => {
    const weapon =
      company.weapons?.find((w) => w.kind === cat.weapon?.kind && w.grade === cat.weapon.grade) ??
      DEFAULT_WEAPON
    const gun = loadoutOf(weapon, hero.upgrades)
    return {
      kind: weapon.kind,
      grade: weapon.grade,
      damage: (gun.damage * cat.damagePercent) / 100,
      bulletPower: gun.bulletPower,
      // 서버처럼 연사 강화 뒤에 고양이 특성을 곱한다. 화면의 가장 빠른 간격(60ms)은 그대로다.
      fireMs: Math.max(60, gun.fireMs / (cat.firePercent / 100)),
      bulletSpeed: gun.bulletSpeed,
      critical: cat.criticalPercent / 100,
      look: CAT_LOOKS[cat.code],
    }
  })
  return loadout
}
