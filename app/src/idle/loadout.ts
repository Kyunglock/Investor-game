import type { Company } from '@web/api/client'
import { loadoutOf } from '../mental/cards'
import { DEFAULT_WEAPON, heroOf } from '../mental/hero'

export function idleLoadout(company: Company) {
  const hero = heroOf(company)
  const loadout = loadoutOf(hero.weapon, hero.upgrades)
  const owned = new Set(company.idle?.skills.filter((s) => s.owned).map((s) => s.code))
  // 출전한 고양이만 함께 쏘고 제 스킬을 쓴다 (488번). 총이 없는 고양이는 기본 권총을 쏜다(서버 IdleEngine과 같다).
  const cats = company.idle?.cats.filter((cat) => cat.fielded) ?? []
  loadout.water = owned.has('water') ? 1 : 0
  loadout.meteor = cats.some((cat) => cat.code === 'meteor') ? 1 : 0
  loadout.lightning = owned.has('bolt') ? 1 : 0
  loadout.earth = cats.some((cat) => cat.code === 'ram') ? 1 : 0
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
