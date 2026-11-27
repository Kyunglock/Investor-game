import type { Company } from '@web/api/client'
import { idleLoadout, permanentLoadout } from './loadout'
import { fieldedInOrder } from './seats'
import { teamDps, type Vault, vaultLoadout } from './vaultBattle'

/**
 * 파티 (decisions.md 654번): 금고 도전(보스전·주간 던전)에 데려갈 고양이를 돌파의 출전 칸과 따로 저장하고, 던전에서는 추천 편성을 고른다.
 *
 * - 금고 전투는 화면이 판을 차리므로(641번) 파티는 이 기기에 저장한다. 회사마다, 보스전·던전마다 따로다. 저장한 적이 없으면 출전 칸의 고양이다.
 * - 추천은 팀 화력의 어림(teamDps)으로 고른다. 사장냥의 총은 누구를 데려가도 같고 고양이의 몫은 서로 더해지므로, 고양이마다 따로 잰 몫이 큰 차례로
 *   칸 수만큼 고르면 그것이 가장 센 파티다. 금고 전투에는 영구 강화만 반영한다.
 * - 보스전에는 추천 편성 단추와 천적 고양이가 없다 (694번): 누구를 데려갈지는 예상 피해량을 보고 직접 고른다.
 */
export type PartyMode = 'boss' | 'dungeon'
const key = (companyId: string, mode: PartyMode) => `vault-party:${companyId}:${mode}`

/** 저장한 파티. 없거나 읽지 못하면 null. */
export function readParty(companyId: string, mode: PartyMode): string[] | null {
  try {
    const raw = localStorage.getItem(key(companyId, mode))
    if (!raw) return null
    const codes: unknown = JSON.parse(raw)
    return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : null
  } catch {
    return null
  }
}

export function saveParty(companyId: string, mode: PartyMode, codes: readonly string[]) {
  try {
    localStorage.setItem(key(companyId, mode), JSON.stringify(codes))
  } catch {
    // 저장하지 못해도 이번 판에는 그대로 쓴다.
  }
}

/** 실제로 데려갈 파티: 저장한 것 가운데 가진 고양이만, 칸 수까지. 저장한 적이 없으면 지금 출전한 고양이. */
export function partyOf(company: Company, saved: readonly string[] | null): string[] {
  const cats = company.idle?.cats ?? []
  const slots = company.idle?.fieldSlots ?? 0
  const owned = new Set<string>(cats.filter((c) => c.level > 0).map((c) => c.code))
  const codes = saved ?? fieldedInOrder(cats).map((c) => c.code)
  return [...new Set(codes)].filter((code) => owned.has(code)).slice(0, slots)
}

/** 금고 전투의 모드와 훈련 정보. */
export interface Matchup {
  vault: Vault
  boss: boolean
}

/** 파티가 전투 1초에 내는 피해의 어림. 상대가 있으면 그 배율까지 곱한다. */
export function partyDps(company: Company, party: readonly string[] | undefined, vs?: Matchup) {
  const team = vs ? permanentLoadout(company, party) : idleLoadout(company, party)
  if (!vs) return teamDps(team)
  const training = 1 + vs.vault.trainingPercent / 100
  return teamDps(vaultLoadout(team, { damage: training }))
}

/** 고양이 한 마리가 팀에 더하는 초당 피해(사장냥의 몫을 뺀 것). */
export function catDps(company: Company, code: string, vs?: Matchup) {
  return partyDps(company, [code], vs) - partyDps(company, [], vs)
}

/** 추천 파티: 가진 고양이 가운데 더하는 피해가 큰 차례로 칸 수만큼. */
export function recommendParty(company: Company, vs?: Matchup): string[] {
  const slots = company.idle?.fieldSlots ?? 0
  return (company.idle?.cats ?? [])
    .filter((c) => c.level > 0)
    .map((c) => ({ code: c.code, dps: catDps(company, c.code, vs) }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, slots)
    .map((c) => c.code)
}

/**
 * 돌파의 출전 칸을 target으로 바꾸는 차례 (654번): 서버의 출전 요청을 하나씩 보낸다. 빈 칸이 있으면 세우고, 칸이 다 찼으면 target에 없는
 * 고양이와 바꾼다. target에 없는 고양이가 남으면 마지막에 뺀다.
 */
export type FieldStep = { code: string; fielded: boolean; replaceCode?: string }
export function fieldSteps(
  cats: readonly { code: string; fielded: boolean }[],
  slots: number,
  target: readonly string[],
): FieldStep[] {
  const steps: FieldStep[] = []
  const fielded: string[] = cats.filter((c) => c.fielded).map((c) => c.code)
  const leaving = fielded.filter((code) => !target.includes(code))
  let count = fielded.length
  for (const code of target) {
    if (fielded.includes(code)) continue
    if (count < slots) {
      steps.push({ code, fielded: true })
      count++
    } else {
      const out = leaving.shift()
      if (!out) break
      steps.push({ code, fielded: true, replaceCode: out })
    }
  }
  for (const code of leaving) steps.push({ code, fielded: false })
  return steps
}
