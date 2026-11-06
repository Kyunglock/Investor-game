import type { Grade } from '../../api/client'
import { LADDER } from './grades'

/**
 * 결산 전광판의 말풍선 (증권사 육성 설계 8.3절). 그해 손이 가장 많이 뒤집힌 능력치의 한마디를 손익에 맞춘다: 뒤집혔는데도 벌었으면 "그래도" 한마디, 뒤집히지
 * 않았으면 맞혔는지 틀렸는지. 같은 횟수면 줏대 → 인내심 → 용기 순으로 고른다(꼬드김이 가장 웃기다). 판돈이 없었으면(손익 0, 뒤집힘 없음) 없다.
 */
const BUBBLES: [string, string, string][] = [
  ['conviction', '단톡방 보고 샀습니다…', '단톡방 보고 샀는데 그래도 벌었어요'],
  ['patience', '못 참고 팔았습니다…', '한 번 못 참았지만 그래도 벌었어요'],
  ['courage', '손이 떨려서 못 샀습니다…', '한 번 손이 떨렸지만 그래도 벌었어요'],
]

export function bubbleOf(flips: Record<string, number>, pnl = -1): string | null {
  let best: [string, string, string] | null = null
  let most = 0
  for (const bubble of BUBBLES) {
    const count = flips[bubble[0]] ?? 0
    if (count > most) {
      most = count
      best = bubble
    }
  }
  if (best) {
    return pnl > 0 ? best[2] : best[1]
  }
  if (pnl > 0) {
    return '맞혔습니다!'
  }
  return pnl < 0 ? '이번엔 틀렸네요…' : null
}

/** 전광판·그림의 손익: 만 원 아래는 버리고 부호를 붙인다. +3,068만원, −455만원. */
export function pnlLabel(pnl: number): string {
  const abs = Math.abs(pnl)
  const sign = pnl > 0 ? '+' : pnl < 0 ? '−' : ''
  const eok = Math.floor(abs / 100_000_000)
  const man = Math.floor((abs % 100_000_000) / 10_000)
  const format = new Intl.NumberFormat('ko-KR')
  const parts = [eok > 0 ? `${format.format(eok)}억` : '', man > 0 ? `${format.format(man)}만` : '']
  const text = parts.filter(Boolean).join(' ')
  return text ? `${sign}${text}원` : '0원'
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

/** 박치기로 무너뜨리는 라이벌 증권사 (decisions.md 243번). 지어낸 이름이고 해마다 바뀐다. */
const RIVALS = ['한탕증권', '불개미투자', '떡상자산운용', '물타기증권', '존버캐피탈']

export function rivalFor(year: number): string {
  return RIVALS[year % RIVALS.length]
}
