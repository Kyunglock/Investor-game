import type { Company, Grade } from '@web/api/client'
import type { Sex } from '@web/features/game/types'

/** 아군: 사무실의 도트 직원 그대로. 성별(사무실 그림과 같은 규칙: 번호 짝수면 여자)과 종합 등급(차림새)로 그린다 (#423). */
export interface Hero {
  sex: Sex
  grade: Grade
  name: string
}

/** 싸우는 사람: 팀장이 있으면 팀장, 없으면 앉은 사람 가운데 첫째, 아무도 없으면 사장이 직접(후드티). */
export function heroOf(company: Company): Hero {
  const e =
    company.employees.find((x) => x.leader) ??
    company.employees.find((x) => x.desk) ??
    company.employees[0]
  if (!e) {
    return { sex: 'M', grade: 'F', name: '사장' }
  }
  return { sex: e.id % 2 === 0 ? 'F' : 'M', grade: e.overallGrade, name: e.name }
}
