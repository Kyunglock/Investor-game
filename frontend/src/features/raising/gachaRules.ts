import type { Company } from '../../api/client'
import { money } from '../game/labels'

/** 이 값부터는 다이아 수를 게임 금액처럼 줄여 적는다. */
const DIAMOND_COMPACT = 100_000

/** 다이아 수를 적는다 (decisions.md 526번): 평소엔 쉼표를 찍은 수 그대로, 아주 많으면 줄여서. */
export function diamondText(amount: number): string {
  return amount >= DIAMOND_COMPACT ? money(amount) : amount.toLocaleString()
}

/** 가진 다이아로 뽑을 수 있는 직원 수 (526번): 한 명에 diamonds.hire. */
export function affordable(company: Company): number {
  const d = company.diamonds
  return d.hire > 0 ? Math.floor(d.amount / d.hire) : Number.MAX_SAFE_INTEGER
}

/** 지금 데려올 수 있는 직원 수: 다이아가 닿는 수와 남은 자리 가운데 작은 쪽. 채용 탭의 표가 쓴다. */
export function hirable(company: Company): number {
  return Math.max(0, Math.min(affordable(company), company.seats - company.employees.length))
}

/** 한 번에 뽑을 수 있는 수: 다이아가 닿는 수·데리고 있을 자리·한 번에 뽑는 최대 가운데 작은 쪽. */
export function drawable(company: Company): number {
  const g = company.gacha
  return Math.max(0, Math.min(affordable(company), g.rosterMax - g.roster, g.maxDraws))
}

/** 도감을 몇 칸 채웠나. */
export function collected(company: Company): number {
  return company.gacha.collection.filter((c) => c.count > 0).length
}
