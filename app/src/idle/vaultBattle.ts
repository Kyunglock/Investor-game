import type { Company } from '@web/api/client'
import { type AssaultSpec, assaultSpec, IDLE_GAME_SPEED } from '../mental/assault'
import { BASE_LOADOUT, bulletStats, type Loadout, type Spell } from '../mental/cards'
import type { DamageKind } from '../mental/damageNumbers'
import { simScale } from '../mental/gameSpeed'
import {
  auroraNightStats,
  earthStats,
  fallStats,
  flowStats,
  isFall,
  isFlow,
  lightningStats,
} from '../mental/magic'
import { isArrowSpell } from '../mental/spellbook'

/**
 * 금고 도전의 화면 규칙 (decisions.md 641번). 보상과 주마다 바뀌는 것(약점·내성·천적·카드)은 서버가 정해 company.vault로 주고,
 * 이 파일은 그 값으로 전투 한 판을 차린다.
 *
 * - 보스전은 정해진 시간 동안 넣은 피해량을 겨룬다. 약점 스킬은 세게, 내성 스킬은 약하게 들어가고 천적 고양이는 총이 세다.
 * - 주간 던전의 벽과 수호냥은 지금 출전한 팀의 화력을 따라 단단해진다. 강해지는 것만으로는 쉬워지지 않고, 고른 카드와 금고 훈련이 판을 가른다.
 */
export type Vault = NonNullable<Company['vault']>
export type VaultCard = Vault['dungeon']['cards'][number]

export const vaults = ['자수정 금고', '월광 금고', '황혼 금고'] as const
export const GUARDIAN = '흑금 수호냥'

/** 금고 전투의 실제 1초가 전투 시계로 몇 초인가 (gameSpeed.ts). */
export const VAULT_SIM = simScale(IDLE_GAME_SPEED)

/** 스킬 하나의 초당 피해 배율(스킬 피해 바탕에 곱한다). */
function spellRate(spell: Spell, level: number): number {
  if (spell === 'auroraNight') {
    const stats = auroraNightStats(level)
    return stats.damage / stats.cooldown
  }
  if (isFlow(spell)) {
    const s = flowStats(spell, level)
    return s.damage / (isArrowSpell(spell) ? s.cooldown * VAULT_SIM : s.cooldown)
  }
  if (isFall(spell)) {
    const s = fallStats(spell, level)
    return (s.damage * s.count) / s.cooldown
  }
  if (spell === 'earth') {
    const s = earthStats(level)
    return (s.damage * s.siege) / s.cooldown
  }
  const s = lightningStats(level)
  return (s.damage * s.bolts) / s.cooldown
}

/**
 * 팀이 전투 1초에 내는 피해의 어림: 사장냥과 고양이들의 총, 고양이 스킬. 치명타와 범위 피해는 세지 않는다. scale을 주면 스킬 피해에
 * 그 종류의 배율(보스의 약점·내성)을 곱한다.
 */
export function teamDps(loadout: Loadout, scale?: (kind: DamageKind) => number): number {
  const gun = (g: Pick<Loadout, 'damage' | 'bulletPower' | 'fireMs'>) =>
    (bulletStats(g).damage * 1000) / g.fireMs
  let total = gun(loadout)
  for (let i = 0; i < loadout.mates; i++) total += gun(loadout.mateGuns[i] ?? loadout)
  const base = loadout.skillDamage ?? loadout.damage
  loadout.mateMagic?.forEach((spells, i) => {
    const level = loadout.mateMagicLevels?.[i] ?? 1
    for (const spell of spells)
      total += base * spellRate(spell, level) * (scale?.(spell as DamageKind) ?? 1)
  })
  return total
}

/** 팀의 화력이 처음 권총 한 자루의 몇 배인가: 금고의 벽과 수호냥이 이만큼 단단해진다. */
export function teamScale(loadout: Loadout): number {
  return Math.max(1, teamDps(loadout) / teamDps(BASE_LOADOUT))
}

/**
 * 던전의 난이도 (scripts/vaultCheck.mjs를 VAULT_TUNE=1로 돌려 쟀다). 벽과 수호냥의 체력은 팀 화력만큼 키운 뒤 층의 배율을 곱한다.
 * 매도 물량은 키우지 않는다: 물량의 수량이 곧 매수벽을 깎는 양이라, 키우면 강한 팀일수록 매수벽이 한 번에 무너진다.
 * 벽을 두껍게 하기보다 수를 늘린다: 한 벽 앞에 오래 막히면 물량이 잦아져(assault.ts spawnSeconds) 시간보다 멘탈이 먼저 바닥난다.
 * 고양이 넷인 팀이 카드 없이 1층 40초·2층 75초(배율 1.3)·3층 120초(배율 1.6)쯤에 깼고, 3층이 빠듯하도록 배율을 조금 더 올렸다.
 */
export const FLOOR_HP = [1, 1.5, 2.1] as const
/** 층마다 수호냥의 벽 앞에 서는 매도벽의 수. */
export const FLOOR_WALLS = [2, 3, 4] as const
/** 수호냥과 그 벽의 체력 배율: 가장 오래 막히는 구간이라 절반으로 낮췄다. */
export const GUARDIAN_HP = 0.5
/** 던전에서 매도 물량이 나오는 빈도의 배율. */
export const DUNGEON_FLOW = 0.6

interface Mods {
  damage: number
  fire: number
  skill: number
  mental: number
  enemyHp: number
  enemySpeed: number
  wallHp: number
  bossHp: number
}

/** 고른 카드들의 배율을 곱해 하나로 만든다. */
export function cardMods(cards: readonly VaultCard[]): Mods {
  const mods: Mods = {
    damage: 1,
    fire: 1,
    skill: 1,
    mental: 1,
    enemyHp: 1,
    enemySpeed: 1,
    wallHp: 1,
    bossHp: 1,
  }
  for (const card of cards) {
    mods.damage *= card.damagePercent / 100
    mods.fire *= card.firePercent / 100
    mods.skill *= card.skillPercent / 100
    mods.mental *= card.mentalPercent / 100
    mods.enemyHp *= card.enemyHpPercent / 100
    mods.enemySpeed *= card.enemySpeedPercent / 100
    mods.wallHp *= card.wallHpPercent / 100
    mods.bossHp *= card.bossHpPercent / 100
  }
  return mods
}

/**
 * 금고 전투에 나가는 팀의 수치: 공격력(damage)·공격 속도(fire)·스킬 피해(skill)·최대 멘탈(mental) 배율을 붙인다. 천적 고양이의 총 피해
 * 배율은 없앴다 (694번).
 */
export function vaultLoadout(
  loadout: Loadout,
  mods: Partial<Pick<Mods, 'damage' | 'fire' | 'skill' | 'mental'>>,
): Loadout {
  const damage = mods.damage ?? 1
  const fire = mods.fire ?? 1
  return {
    ...loadout,
    damage: loadout.damage * damage,
    fireMs: Math.max(60, loadout.fireMs / fire),
    maxMental: Math.max(1, Math.round(loadout.maxMental * (mods.mental ?? 1))),
    skillDamage: (loadout.skillDamage ?? loadout.damage) * damage * (mods.skill ?? 1),
    mateGuns: loadout.mateGuns.map((gun) => ({
      ...gun,
      damage: gun.damage * damage,
      fireMs: Math.max(60, gun.fireMs / fire),
    })),
  }
}

/** 서버의 스킬 코드 → 전투의 피해 종류. 번개는 튄 피해, 충차는 들이받기도 같은 스킬이다. */
const SKILL_KINDS: Record<string, DamageKind[]> = {
  bolt: ['lightning', 'chain'],
  ram: ['earth', 'siege'],
}

/** 이번 주 수호냥의 약점·내성: 피해 종류 → 배율. 총알과 나머지 스킬은 1이다. */
export function bossScale(boss: Vault['boss']): (kind: DamageKind) => number {
  const table = new Map<DamageKind, number>()
  const put = (skills: Vault['boss']['weakSkills'], percent: number) => {
    for (const skill of skills) {
      for (const kind of SKILL_KINDS[skill.code] ?? [skill.code as DamageKind]) {
        table.set(kind, percent / 100)
      }
    }
  }
  put(boss.weakSkills, boss.weakPercent)
  put(boss.resistSkills, boss.resistPercent)
  return (kind) => table.get(kind) ?? 1
}

/** 보스전 한 판: 수호냥의 금고벽 하나. 벽과 수호냥은 쓰러지지 않는다(battle.ts vault.score). */
export function bossEncounter(): AssaultSpec {
  const spec = assaultSpec(3, { name: GUARDIAN })
  return { ...spec, walls: [spec.walls[spec.walls.length - 1]] }
}

/** 던전의 floor층: 매도벽 몇 개 뒤에 수호냥의 벽이 선다. 벽과 수호냥은 팀 화력과 층을 따라 단단해지고 카드가 그것을 깎는다. */
export function dungeonEncounter(
  floor: number,
  week: number,
  scale: number,
  cards: readonly VaultCard[] = [],
): AssaultSpec {
  const mods = cardMods(cards)
  const spec = assaultSpec(floor, { name: vaults[Math.abs(week) % vaults.length] })
  const at = Math.min(FLOOR_HP.length, Math.max(1, floor)) - 1
  const hp = scale * FLOOR_HP[at]
  const guardian = spec.walls[spec.walls.length - 1]
  const approach = Array.from({ length: FLOOR_WALLS[at] }, (_, i) => spec.walls[(week + i) % 4])
  return {
    ...spec,
    walls: [...approach, guardian].map((wall) => ({
      ...wall,
      cellHp: wall.cellHp * hp * (wall.boss ? GUARDIAN_HP : 1) * mods.wallHp,
    })),
    enemyHp: spec.enemyHp * mods.enemyHp,
    enemySpeed: spec.enemySpeed * mods.enemySpeed,
    enemyCount: spec.enemyCount * DUNGEON_FLOW,
    bossHp: spec.bossHp * hp * GUARDIAN_HP * mods.bossHp,
  }
}

/** 보스전 등급의 규칙 (서버 VaultEngine과 같다): 문턱은 피해량 10에서 한 등급마다 1.5배, 열 등급씩 리그가 바뀌고 마스터는 끝이 없다. */
const TIER_BASE = 10
const TIER_GROWTH = 1.5
const LEAGUES = ['브론즈', '실버', '골드', '플래티넘', '다이아', '마스터'] as const
const LEAGUE_TIERS = 10

/** 피해량이 닿은 등급과 그 이름, 다음 등급까지 찬 만큼(0~1). 등급이 없으면 tier 0이고 첫 등급까지 찬 만큼이다. */
export function bossTier(damage: number): { tier: number; name: string; fill: number } {
  if (!(damage >= TIER_BASE)) {
    return { tier: 0, name: '등급 없음', fill: Math.max(0, damage) / TIER_BASE }
  }
  const tier = 1 + Math.floor(Math.log(damage / TIER_BASE) / Math.log(TIER_GROWTH) + 1e-9)
  const floor = TIER_BASE * TIER_GROWTH ** (tier - 1)
  const league = Math.min(LEAGUES.length - 1, Math.floor((tier - 1) / LEAGUE_TIERS))
  return {
    tier,
    name: `${LEAGUES[league]} ${tier - league * LEAGUE_TIERS}`,
    fill: Math.min(1, (damage - floor) / (floor * (TIER_GROWTH - 1))),
  }
}

const UNITS = ['', '만', '억', '조', '경', '해', '자', '양'] as const

/** 피해량을 화면의 글로: 전투의 피해 숫자처럼 10배로 적고(damageNumbers.ts), 만 단위로 끊어 큰 자리 둘만 보인다. */
export function scoreText(damage: number): string {
  let n = Math.max(0, Math.round(damage * 10))
  if (n < 10_000) return n.toLocaleString('ko-KR')
  let unit = 0
  let rest = 0
  while (n >= 10_000 && unit < UNITS.length - 1) {
    rest = n % 10_000
    n = Math.floor(n / 10_000)
    unit++
  }
  const small = Math.floor(rest / 1_000)
  return `${n.toLocaleString('ko-KR')}${small && n < 100 ? `.${small}` : ''}${UNITS[unit]}`
}

/** 남은 시간을 "3일 4시간"·"5시간 12분"·"8분"으로. */
export function leftText(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}일 ${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`
  return `${minutes}분`
}
