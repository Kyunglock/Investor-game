import type { Company } from '../../api/client'
import { STAT_NAMES } from './grades'

type Desk = Company['desks'][number]

/** 자리 고르기의 한 줄: 원하는 능력치, 이 시대에 뜨는 자리, 그 직원의 관심 섹터 (증권사 육성 설계 4.2·9.4절). */
export function deskLabel(
  desk: Pick<Desk, 'name' | 'statCode' | 'sector' | 'hot'>,
  sector?: string | null,
) {
  const marks = [STAT_NAMES[desk.statCode]]
  if (desk.hot) {
    marks.push('이번 시대 ★')
  }
  if (sector && desk.sector === sector) {
    marks.push('관심 섹터')
  }
  return `${desk.name} (${marks.join(' · ')})`
}
