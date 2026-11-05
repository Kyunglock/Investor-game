import type { Company, Grade } from '../../api/client'
import { LADDER } from './grades'

type Employee = Company['employees'][number]
export type Seat = { employeeId: number; desk: string | null }

/** 자리별로 보는 능력치의 등급 순위. 높을수록 맞다. 화면에는 숫자가 없어 등급으로 견준다. */
function score(e: Employee, stat: string): number {
  return LADDER.indexOf(e.grades[stat] as Grade)
}

/**
 * 자동 배치 (decisions.md 232번). 돈을 굴리는 자리부터 채운다: 바이오(인내심)·단타(용기)에 둘을 짝지어 앉히는데, 두 사람의 맞는 정도를 더한 값이 가장 큰
 * 짝을 고른다. 판돈은 돈을 굴리는 사람끼리 나누므로 셋째부터는 돕는 자리가 낫다: 폭락 조짐이 있으면 리스크 관리 팀(줏대), 아니면 리서치 팀(안목)을 먼저,
 * 그다음 다른 하나, 그다음 인사팀(안목). 그래도 사람과 자리가 남으면 돈을 굴리는 자리에 더 앉힌다. 자리가 모자라면 남은 사람은 쉰다.
 */
export function autoPlace(company: Company): Seat[] {
  const desks = new Map(company.desks.map((d) => [d.code, d]))
  const left = [...company.employees]
  const placed = new Map<number, string>()
  let seats = company.seats

  const take = (e: Employee, desk: string) => {
    placed.set(e.id, desk)
    left.splice(left.indexOf(e), 1)
    seats--
  }
  const best = (stat: string) =>
    left.reduce<Employee | null>((a, e) => (!a || score(e, stat) > score(a, stat) ? e : a), null)

  const bio = desks.get('bio')
  const day = desks.get('day')
  if (bio && day && seats >= 2 && left.length >= 2) {
    let pair: [Employee, Employee] | null = null
    let top = -1
    for (const a of left) {
      for (const b of left) {
        const sum = a === b ? -1 : score(a, bio.statCode) + score(b, day.statCode)
        if (sum > top) {
          top = sum
          pair = [a, b]
        }
      }
    }
    if (pair) {
      take(pair[0], 'bio')
      take(pair[1], 'day')
    }
  } else if (seats >= 1 && left.length >= 1) {
    // 한 사람뿐이면 둘 가운데 더 맞는 쪽에 앉힌다.
    const one = left[0]
    const desk = [bio, day]
      .filter((d) => d !== undefined)
      .reduce((a, d) => (score(one, d.statCode) > score(one, a.statCode) ? d : a))
    take(one, desk.code)
  }

  const support = company.meeting?.omen ? ['risk', 'research', 'hr'] : ['research', 'risk', 'hr']
  for (const code of support) {
    const desk = desks.get(code)
    const e = desk && best(desk.statCode)
    if (seats > 0 && desk && e) {
      take(e, code)
    }
  }
  while (seats > 0 && left.length > 0 && bio && day) {
    const e = left[0]
    take(e, score(e, bio.statCode) >= score(e, day.statCode) ? 'bio' : 'day')
  }
  return company.employees.map((e) => ({ employeeId: e.id, desk: placed.get(e.id) ?? null }))
}
