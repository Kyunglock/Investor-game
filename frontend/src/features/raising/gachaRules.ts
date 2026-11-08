import type { Company } from '../../api/client'

/** 한 번에 뽑을 수 있는 수: 채용권·데리고 있을 자리·한 번에 뽑는 최대 가운데 작은 쪽. */
export function drawable(company: Company): number {
  const g = company.gacha
  return Math.max(0, Math.min(g.tickets, g.rosterMax - g.roster, g.maxDraws))
}

/** 도감을 몇 칸 채웠나. */
export function collected(company: Company): number {
  return company.gacha.collection.filter((c) => c.count > 0).length
}
