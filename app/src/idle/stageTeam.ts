import type { Company } from '@web/api/client'
import { type Loadout, loadoutOf, MAX_MATES } from '../mental/cards'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'
import { fieldedInOrder } from './seats'

/**
 * 스테이지 출전 고양이 (decisions.md 669번): 매도벽 돌파 스테이지에 데려갈 고양이를 메인 화면의 출전 칸과 따로 고른다. 스테이지는 사장냥
 * 혼자 시작하고, "고양이 카드"를 고를 때마다 여기서 고른 고양이가 고른 차례대로 한 마리씩 나온다. 나온 고양이는 제 무기를 쏘고 제 고유 스킬을
 * Lv.1부터 쓰며, 스킬 강화 카드로 그 판 안에서 레벨을 올린다.
 *
 * 스테이지는 화면이 판을 차리므로 이 기기에 저장한다(금고 파티와 같다, 654번). 고른 적이 없으면 지금 출전한 고양이의 앞에서부터다.
 */
export const STAGE_TEAM_MAX = MAX_MATES

const key = (companyId: string) => `stage-team:${companyId}`

export function readStageTeam(companyId: string): string[] | null {
  try {
    const raw = localStorage.getItem(key(companyId))
    if (!raw) return null
    const codes: unknown = JSON.parse(raw)
    return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : null
  } catch {
    return null
  }
}

export function saveStageTeam(companyId: string, codes: readonly string[]) {
  try {
    localStorage.setItem(key(companyId), JSON.stringify(codes))
  } catch {
    // 저장하지 못해도 이번 판에는 그대로 쓴다.
  }
}

/** 실제로 데려갈 고양이: 고른 것 가운데 가진 고양이만, STAGE_TEAM_MAX마리까지. 고른 적이 없으면 지금 출전한 고양이. */
export function stageTeamOf(company: Company, saved: readonly string[] | null): string[] {
  const cats = company.idle?.cats ?? []
  const owned = new Set<string>(cats.filter((c) => c.level > 0).map((c) => c.code))
  const codes = saved ?? fieldedInOrder(cats).map((c) => c.code)
  return [...new Set(codes)].filter((code) => owned.has(code)).slice(0, STAGE_TEAM_MAX)
}

/**
 * 스테이지 한 판의 처음 수치: 사장냥의 총에, 나올 고양이들의 총·그림·고유 스킬을 미리 실어 둔다. 고양이는 아직 없고(mates 0) 고양이 카드를
 * 고를 때마다 앞에서부터 나온다. 고유 스킬은 모두 Lv.1에서 시작한다.
 */
export function stageLoadout(company: Company, team: readonly string[]): Loadout {
  const hero = heroOf(company)
  const base = loadoutOf(hero.weapon, hero.upgrades)
  if (team.length === 0) return base
  const full = idleLoadout(company, team)
  const cats = team.flatMap((code) => (company.idle?.cats ?? []).filter((c) => c.code === code))
  return {
    ...base,
    mateGuns: full.mateGuns,
    mateMagic: full.mateMagic,
    mateMagicLevels: cats.map(() => 1),
    stageCats: cats.map((cat) => ({ name: cat.name, skills: cat.skills.map((s) => s.name) })),
  }
}
