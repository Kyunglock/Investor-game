import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { loadoutOf } from '../mental/cards'
import { NEW_CATS } from '../mental/catRoster'
import { DEFAULT_WEAPON, heroOf } from '../mental/hero'
import { EXTRA_SPELLS, type ExtraSpell } from '../mental/spellbook'
import { fieldedInOrder } from './seats'

/** 고양이마다 전투 그림이 정해져 있다 (mates.ts MATE_LOOKS의 차례, 492번). */
export const CAT_LOOKS = {
  sky: 0,
  mint: 1,
  lilac: 2,
  sunset: 3,
  night: 4,
  snow: 5,
  ...Object.fromEntries(NEW_CATS.map((cat, i) => [cat.code, i + 6])),
} as Record<CatCode, number>

/** 서버의 스킬 코드 → 전투의 마법. */
const SKILL_MAGIC = {
  water: 'water',
  meteor: 'meteor',
  bolt: 'lightning',
  ram: 'earth',
  ice: 'ice',
  wind: 'wind',
  // spellbook의 마법들은 서버 코드와 이름이 같다 (563번).
  ...(Object.fromEntries(EXTRA_SPELLS.map((spell) => [spell, spell])) as {
    [K in ExtraSpell]: K
  }),
} as const

export function idleLoadout(company: Company) {
  const hero = heroOf(company)
  const loadout = loadoutOf(hero.weapon, hero.upgrades)
  // 스킬은 고양이의 고유 능력이다 (501번): 출전한 고양이가 제 총을 쏘고 제 스킬을 쓴다. 스킬은 A등급부터 있고 S등급은 둘이다 (561번).
  // 총이 없으면 기본 권총이다(서버 IdleEngine과 같다).
  // 출전 칸의 번호순으로 줄을 선다 (599번).
  const cats = fieldedInOrder(company.idle?.cats ?? [])
  loadout.mateMagic = cats.map((cat) => cat.skills.map((skill) => SKILL_MAGIC[skill.code]))
  // 스킬 레벨은 고양이마다 다르다 (515번). 마법 칸(loadout.water 등)에는 그 스킬의 가장 높은 레벨을 둔다.
  loadout.mateMagicLevels = cats.map((cat) => cat.skillLevel)
  for (const cat of cats) {
    for (const skill of cat.skills) {
      const magic = SKILL_MAGIC[skill.code]
      // 카드 마법 넷만 마법 칸이 있다. 얼음·바람과 spellbook의 마법은 고양이 스킬로만 나간다.
      if (magic === 'water' || magic === 'meteor' || magic === 'lightning' || magic === 'earth')
        loadout[magic] = Math.max(loadout[magic], cat.skillLevel)
    }
  }
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
      tag: { code: cat.code, name: cat.name, grade: cat.grade },
    }
  })
  return loadout
}
