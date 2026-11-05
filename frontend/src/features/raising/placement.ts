import type { Company, Grade } from '../../api/client'
import { LADDER } from './grades'

type Employee = Company['employees'][number]
type Desk = Company['desks'][number]
export type Seat = { employeeId: number; desk: string | null }

/** 자리별로 보는 능력치의 등급 순위. 높을수록 맞다. 화면에는 숫자가 없어 등급으로 견준다. */
function score(e: Employee, stat: string): number {
  return LADDER.indexOf(e.grades[stat] as Grade)
}

/**
 * 돈을 굴리는 자리에 맞는 정도: 자리가 원하는 능력치의 등급에, 이 시대에 뜨는 자리면 한 칸, 직원의 관심 섹터와 같은 섹터 데스크면 반 칸을 더한다
 * (decisions.md 233번). 시대 보너스(+4%p)가 관심 섹터 보너스(+2%p)보다 커서 그만큼 더 쳐준다.
 */
function tradeScore(e: Employee, d: Desk): number {
  return score(e, d.statCode) + (d.hot ? 1 : 0) + (e.sector && d.sector === e.sector ? 0.5 : 0)
}

/** 그 직원에게 가장 맞는 돈 굴리는 자리. 같으면 자리 순서가 앞인 쪽. */
function bestTrading(e: Employee, trading: Desk[]): { desk: Desk; score: number } {
  return trading
    .map((desk) => ({ desk, score: tradeScore(e, desk) }))
    .reduce((a, b) => (b.score > a.score ? b : a))
}

/**
 * 자동 배치 (decisions.md 232·233번). 돈을 굴리는 자리부터 채운다: 가장 맞는 돈 굴리는 자리가 가장 잘 맞는 두 사람을 그 자리에 앉힌다(섹터 데스크 여섯과
 * 단타 데스크 가운데, 같은 자리에 둘이 앉아도 된다). 판돈은 돈을 굴리는 사람끼리 나누므로 셋째부터는 돕는 자리가 낫다: 폭락 조짐이 있으면 리스크 관리 팀(줏대),
 * 아니면 리서치 팀(안목)을 먼저, 그다음 다른 하나, 그다음 인사팀(안목). 그래도 사람과 자리가 남으면 돈을 굴리는 자리에 더 앉힌다. 자리가 모자라면 남은 사람은
 * 쉰다.
 */
export function autoPlace(company: Company): Seat[] {
  const desks = new Map(company.desks.map((d) => [d.code, d]))
  const trading = company.desks.filter((d) => d.trades)
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
  const trade = (count: number) => {
    const ranked = [...left].sort(
      (a, b) => bestTrading(b, trading).score - bestTrading(a, trading).score,
    )
    for (const e of ranked.slice(0, Math.min(count, seats))) {
      take(e, bestTrading(e, trading).desk.code)
    }
  }

  if (trading.length > 0) {
    trade(2)
  }
  const support = company.meeting?.omen ? ['risk', 'research', 'hr'] : ['research', 'risk', 'hr']
  for (const code of support) {
    const desk = desks.get(code)
    const e = desk && best(desk.statCode)
    if (seats > 0 && desk && e) {
      take(e, code)
    }
  }
  if (trading.length > 0) {
    trade(left.length)
  }
  return company.employees.map((e) => ({ employeeId: e.id, desk: placed.get(e.id) ?? null }))
}
