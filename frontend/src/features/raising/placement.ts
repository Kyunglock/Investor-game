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
function tradeScore(e: Employee, d: Desk, omen = false): number {
  return (
    score(e, d.statCode) +
    (d.hot ? 1 : 0) +
    (e.sector && d.sector === e.sector ? 0.5 : 0) +
    (omen && crashSafe(d) ? 1 : 0)
  )
}

/** 폭락장에 덜 빠지는 자리(식품·금융, 폭락장 손익 절반 이하). */
export function crashSafe(d: Desk): boolean {
  return d.trades && d.crashPercent != null && d.crashPercent <= 50
}

/**
 * 한 사람에게 맞는 자리 순서 (decisions.md 259번): 돈을 굴리는 자리는 자동 배치와 같은 점수로, 돕는 자리는 원하는 능력치로 견준다. 배치 탭이 맞는 자리 셋만
 * 먼저 보이는 데 쓴다. 같으면 자리 순서대로.
 */
export function rankDesks(company: Company, e: Employee): Desk[] {
  const omen = Boolean(company.meeting?.omen)
  return company.desks
    .map((d, i) => ({ d, i, s: d.trades ? tradeScore(e, d, omen) : score(e, d.statCode) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.d)
}

/** 그 직원에게 가장 맞는 돈 굴리는 자리. 같으면 자리 순서가 앞인 쪽. */
function bestTrading(e: Employee, trading: Desk[], omen = false): { desk: Desk; score: number } {
  return trading
    .map((desk) => ({ desk, score: tradeScore(e, desk, omen) }))
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
  // 폭락 조짐이 있으면 폭락장에 덜 빠지는 자리를 한 칸 더 쳐준다: 자리가 둘뿐이면 리스크 관리 팀에 사람을 뺄 여유가 없다 (259번).
  const omen = Boolean(company.meeting?.omen)
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
      (a, b) => bestTrading(b, trading, omen).score - bestTrading(a, trading, omen).score,
    )
    for (const e of ranked.slice(0, Math.min(count, seats))) {
      take(e, bestTrading(e, trading, omen).desk.code)
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

/** 한 사람만 자리를 바꾼 배치. 나머지는 그대로 둔다. 배치 탭의 자리 버튼과 건물 그림의 자리 고르기가 같이 쓴다 (decisions.md 237번). */
export function seatOne(company: Company, employeeId: number, desk: string | null): Seat[] {
  return company.employees.map((e) => ({
    employeeId: e.id,
    desk: e.id === employeeId ? desk : (e.desk ?? null),
  }))
}

/** 자리의 예상 효과 한 줄 (decisions.md 259번): 맞히면 몇 %, 틀리면 몇 %, 폭락장에 덜 빠지는가. 돕는 자리면 설명. */
export function deskEffect(d: Desk): string {
  if (!d.trades || d.gainBp == null || d.missBp == null) {
    return d.description
  }
  const pct = (bp: number) => `${Math.round(bp / 100)}%`
  const crash =
    d.crashPercent != null && d.crashPercent < 100
      ? ' · 폭락장에 덜 빠짐'
      : d.crashPercent != null && d.crashPercent > 100
        ? ' · 폭락장에 더 빠짐'
        : ''
  return `맞히면 +${pct(d.gainBp)} · 틀리면 −${pct(d.missBp)}${crash}`
}
