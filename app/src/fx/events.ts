import type { Company } from '@web/api/client'
import { EMPLOYEE_LADDER, LADDER } from '@web/features/raising/grades'

/** 회사가 바뀌며 일어난 일 (decisions.md 310번). 서버 응답 전후를 견줘 찾고, 효과(소리·진동·터짐·흔들림)로 바꾼다. */
export type FxEvent =
  | { kind: 'capital'; delta: number }
  | { kind: 'hired'; name: string }
  | { kind: 'left'; name: string }
  | { kind: 'quarter'; crash: boolean; delta: number }
  | { kind: 'year-end'; delta: number; achieved: string[] }
  | { kind: 'grade-up'; to: Company['grade'] }
  | { kind: 'grade-down'; to: Company['grade'] }
  | { kind: 'opened'; number: number }
  | { kind: 'landmark' }
  | { kind: 'broke' }

export function companyEvents(before: Company | null, after: Company | null): FxEvent[] {
  if (!after) {
    return []
  }
  if (!before || before.companyId !== after.companyId) {
    return [{ kind: 'opened', number: after.number }]
  }
  const out: FxEvent[] = []
  const yearEnd = after.year > before.year
  const quarter = !yearEnd && after.quarter > before.quarter
  if (yearEnd && after.lastSettlement) {
    const s = after.lastSettlement
    out.push({ kind: 'year-end', delta: s.capitalAfter - s.capitalBefore, achieved: s.achieved })
  } else if (quarter && after.lastQuarter) {
    const q = after.lastQuarter
    out.push({ kind: 'quarter', crash: q.crash, delta: q.capitalAfter - q.capitalBefore })
  }
  const delta = after.capital - before.capital
  if (delta !== 0) {
    out.push({ kind: 'capital', delta })
  }
  const beforeIds = new Set(before.employees.map((e) => e.id))
  const afterIds = new Set(after.employees.map((e) => e.id))
  for (const e of after.employees) {
    if (!beforeIds.has(e.id)) {
      out.push({ kind: 'hired', name: e.name })
    }
  }
  // 합성(314번): 남은 사람의 등급이 오르며 재료가 빠졌다. 합성 판이 효과를 내므로 떠남(연기)으로 치지 않는다.
  const rank = (g: Company['grade']) => EMPLOYEE_LADDER.indexOf(g)
  const beforeGrade = new Map(before.employees.map((e) => [e.id, e.overallGrade]))
  const merged =
    !yearEnd &&
    !quarter &&
    after.employees.some((e) => {
      const was = beforeGrade.get(e.id)
      return was !== undefined && rank(e.overallGrade) > rank(was)
    })
  for (const e of before.employees) {
    if (!merged && !afterIds.has(e.id)) {
      out.push({ kind: 'left', name: e.name })
    }
  }
  const step = LADDER.indexOf(after.grade) - LADDER.indexOf(before.grade)
  if (step > 0) {
    out.push({ kind: 'grade-up', to: after.grade })
  } else if (step < 0) {
    out.push({ kind: 'grade-down', to: after.grade })
  }
  // 랜드마크 타워에 올랐다 (374번): 엔딩은 없지만 크게 축하한다.
  if (after.grade === 'Z' && before.grade !== 'Z') {
    out.push({ kind: 'landmark' })
  }
  if (after.broke && !before.broke) {
    out.push({ kind: 'broke' })
  }
  return out
}
