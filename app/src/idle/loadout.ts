import type { Company } from '@web/api/client'
import { loadoutOf } from '../mental/cards'
import { heroOf } from '../mental/hero'

export function idleLoadout(company: Company) {
  const hero = heroOf(company)
  const loadout = loadoutOf(hero.weapon, hero.upgrades)
  const owned = new Set(company.idle?.skills.filter((s) => s.owned).map((s) => s.code))
  loadout.water = owned.has('water') ? 1 : 0
  loadout.meteor = owned.has('meteor') ? 1 : 0
  loadout.lightning = owned.has('bolt') ? 1 : 0
  loadout.earth = owned.has('ram') ? 1 : 0
  loadout.mates = Number(owned.has('meteor')) + Number(owned.has('ram'))
  return loadout
}
