import type { Grade } from '../../api/client'
import { LADDER } from './grades'

/**
 * 결산 전광판의 말풍선 (증권사 육성 설계 8.3절). 그해 손이 가장 많이 뒤집힌 능력치의 한마디. 뒤집히지 않았으면 null. 같은 횟수면 줏대 → 인내심 → 용기
 * 순으로 고른다(꼬드김이 가장 웃기다).
 */
const BUBBLES: [string, string][] = [
  ['conviction', '단톡방 보고 샀습니다…'],
  ['patience', '못 참고 팔았습니다…'],
  ['courage', '손이 떨려서 못 샀습니다…'],
]

export function bubbleOf(flips: Record<string, number>): string | null {
  let best: string | null = null
  let most = 0
  for (const [stat, line] of BUBBLES) {
    const count = flips[stat] ?? 0
    if (count > most) {
      most = count
      best = line
    }
  }
  return best
}

/** 이사 장면 (8.3절): 회사 등급이 오르면 이삿짐 트럭과 화환, 떨어지면 짐을 줄여 작은 사무실로. */
export function moveOf(before: Grade, after: Grade): 'up' | 'down' | null {
  const diff = LADDER.indexOf(after) - LADDER.indexOf(before)
  return diff > 0 ? 'up' : diff < 0 ? 'down' : null
}

/** 축하 화환을 보낸 사람은 단골 인물이다. 해마다 앞사람이 바뀐다. */
const SENDERS = ['경쟁사 김대리', '리딩방 방장', '사촌 형', '경제 유튜버', '택시 기사님']

export function wreathsFor(year: number): string[] {
  return [0, 1, 2].map((i) => SENDERS[(year + i) % SENDERS.length])
}
