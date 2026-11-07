import type { Company } from '../../api/client'
import { EMPLOYEE_LADDER } from './grades'

type Employee = Company['employees'][number]

/** 합칠 수 있는 한 무리 (decisions.md 312번): 같은 종합 등급이 mergeCount명 이상. */
export interface MergeGroup {
  grade: Company['grade']
  members: Employee[]
}

/** 이직 제안·연봉 협상·사표가 걸린 사람: 먼저 답해야 합치거나 내보낼 수 있다. */
export function busyIds(company: Company): Set<number> {
  const ids = new Set<number>()
  if (company.meeting?.poach) ids.add(company.meeting.poach.employeeId)
  if (company.meeting?.raise) ids.add(company.meeting.raise.employeeId)
  if (company.resign) ids.add(company.resign.employeeId)
  return ids
}

/** 합칠 수 있는 무리. 높은 등급부터. 맨 위(GOD)와 걸린 일이 있는 사람은 빠진다. */
export function mergeGroups(company: Company): MergeGroup[] {
  const need = company.gacha.mergeCount
  const busy = busyIds(company)
  const top = EMPLOYEE_LADDER[EMPLOYEE_LADDER.length - 1]
  const byGrade = new Map<Company['grade'], Employee[]>()
  for (const e of company.employees) {
    if (busy.has(e.id) || e.overallGrade === top) continue
    byGrade.set(e.overallGrade, [...(byGrade.get(e.overallGrade) ?? []), e])
  }
  return [...byGrade.entries()]
    .filter(([, members]) => members.length >= need)
    .map(([grade, members]) => ({ grade, members }))
    .sort((a, b) => EMPLOYEE_LADDER.indexOf(b.grade) - EMPLOYEE_LADDER.indexOf(a.grade))
}

/**
 * 한 무리를 어떻게 합칠까: 바탕은 고른 사람(없으면 자리에 앉은 사람, 팀장 먼저), 재료는 쉬는 사람부터. 자리를 지키는 사람이 오르고 쉬던 사람이 재료가 된다.
 */
export function mergePlan(
  group: MergeGroup,
  mergeCount: number,
  baseId?: number,
): { base: Employee; materials: Employee[] } {
  const rank = (e: Employee) => (e.leader ? 0 : e.desk ? 1 : 2)
  const sorted = [...group.members].sort((a, b) => rank(a) - rank(b) || a.id - b.id)
  const base = sorted.find((e) => e.id === baseId) ?? sorted[0]
  const materials = sorted
    .filter((e) => e.id !== base.id)
    .sort((a, b) => rank(b) - rank(a) || b.id - a.id)
    .slice(0, mergeCount - 1)
  return { base, materials }
}

/** 한 번에 뽑을 수 있는 수: 채용권·데리고 있을 자리·한 번에 뽑는 최대 가운데 작은 쪽. */
export function drawable(company: Company): number {
  const g = company.gacha
  return Math.max(0, Math.min(g.tickets, g.rosterMax - g.roster, g.maxDraws))
}

/** 도감을 몇 칸 채웠나. */
export function collected(company: Company): number {
  return company.gacha.collection.filter((c) => c.count > 0).length
}
