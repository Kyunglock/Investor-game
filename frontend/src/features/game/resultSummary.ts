import type { Game } from '../../api/client'
import type { CreditSection } from './credits'
import { profileReport } from './profile'

/**
 * 결과지 한 장 요약의 재료 (decisions.md 193번). 크레딧의 그림 장에서 인생 하이라이트를 고르고, 투자 성향을 코드 없이 쉬운 말로 바꾼다.
 */

/** 하이라이트로 고르는 순서. 결혼·첫아이·집·실직·위기·여행이 먼저, 첫 일터와 그 밖의 장은 자리가 남으면. */
const PRIORITY = [
  'family',
  'child-1',
  'home-',
  'layoff-',
  'crisis-',
  'trip-',
  'work',
  'child-',
  'wed-',
  'left-',
  'housewarming-',
]

function rank(key: string): number {
  for (let i = 0; i < PRIORITY.length; i++) {
    const p = PRIORITY[i]
    if (p.endsWith('-') ? key.startsWith(p) : key === p) {
      return i
    }
  }
  return PRIORITY.length
}

/** 그림이 붙은 장 가운데 중요한 순서로 max개를 골라, 시간순으로 돌려준다. 태어남·마지막 장은 뺀다. */
export function highlights(sections: CreditSection[], max = 4): CreditSection[] {
  const candidates = sections
    .map((s, order) => ({ s, order }))
    .filter(({ s }) => s.art && s.key !== 'born' && s.key !== 'last' && s.key !== 'title')
  return candidates
    .sort((a, b) => rank(a.s.key) - rank(b.s.key) || a.order - b.order)
    .slice(0, max)
    .sort((a, b) => a.order - b.order)
    .map(({ s }) => s)
}

/** 성향 글자마다 쉬운 한 문장 */
const PLAIN: Record<string, string> = {
  A: '기회가 보이면 크게 거는 편이었다',
  S: '위험을 피하고 안전하게 가는 편이었다',
  L: '한 번 사면 오래 들고 버텼다',
  Q: '짧게 사고팔며 빨리 결판을 봤다',
  D: '여러 종목에 나눠 담았다',
  F: '몇 종목에 몰아 담았다',
  O: '남의 말보다 내 판단을 믿었다',
  C: '주변 분위기를 잘 따라갔다',
}

export interface PlainProfile {
  /** 별명, 예 "뚝심 있는 농부" */
  name: string
  tagline: string
  /** 쉬운 문장과 그 근거(작게) */
  traits: { text: string; evidence: string }[]
  /** 조심할 것 한 줄 */
  caution: string | null
  invested: boolean
}

export function plainProfile(game: Game): PlainProfile {
  const report = profileReport(game)
  const invested = report.stats.yearsInvesting > 0 || report.stats.newsCount > 0
  return {
    name: report.type.name,
    tagline: report.type.tagline,
    traits: report.poles
      .filter((p) => PLAIN[p.letter])
      .map((p) => ({ text: PLAIN[p.letter], evidence: p.evidence })),
    caution: report.recommendations[0] ?? null,
    invested,
  }
}
