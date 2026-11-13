import type { Company } from '@web/api/client'
import { loadoutOf } from '../mental/cards'
import { DEFAULT_WEAPON, heroOf } from '../mental/hero'

export function idleLoadout(company: Company) {
  const hero = heroOf(company)
  const loadout = loadoutOf(hero.weapon, hero.upgrades)
  const owned = new Set(company.idle?.skills.filter((s) => s.owned).map((s) => s.code))
  // 스킬은 벽 돌파로 얻고, 고양이는 스킬과 상관없이 출전하면 제 총을 쏜다 (488·491번). 총이 없으면 기본 권총이다(서버 IdleEngine과 같다).
  const cats = company.idle?.cats.filter((cat) => cat.fielded) ?? []
  loadout.water = owned.has('water') ? 1 : 0
  loadout.meteor = owned.has('meteor') ? 1 : 0
  loadout.lightning = owned.has('bolt') ? 1 : 0
  loadout.earth = owned.has('ram') ? 1 : 0
  loadout.mates = cats.length
  loadout.mateGuns = cats.map((cat) => {
    const weapon =
      company.weapons?.find((w) => w.kind === cat.weapon?.kind && w.grade === cat.weapon.grade) ??
      DEFAULT_WEAPON
    const gun = loadoutOf(weapon, hero.upgrades)
    return {
      kind: weapon.kind,
      grade: weapon.grade,
      damage: gun.damage * (1 + cat.bonusPercent / 100),
      bulletPower: gun.bulletPower,
      fireMs: gun.fireMs,
      bulletSpeed: gun.bulletSpeed,
    }
  })
  return loadout
}
