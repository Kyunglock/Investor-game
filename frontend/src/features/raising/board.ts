import type { Grade } from '../../api/client'
import { bigUnits } from '../game/labels'
import { LADDER } from './grades'

/**
 * 결산 전광판의 말풍선 (증권사 육성 설계 8.3절, decisions.md 254번). 그해 손이 가장 많이 뒤집힌 능력치의 한마디를 손익에 맞춘다: 뒤집혔는데도 벌었으면
 * "그래도" 한마디, 뒤집히지 않았으면 맞혔는지 틀렸는지(크게 벌거나 크게 잃었으면 그만큼). 손익이 0이면 본전이다. 같은 횟수면 줏대 → 인내심 → 용기 순으로
 * 고른다(꼬드김이 가장 웃기다). 같은 상황에도 문구가 여럿이라 직원과 해마다 돌려 가며 고른다: 전에는 다섯 해 말풍선 열에 일곱이 같은 말이었다. 판돈이
 * 없었으면(손익 0, 뒤집힘 없음) 없다.
 */
const FLIPPED: [string, string[], string[]][] = [
  [
    'conviction',
    ['단톡방 보고 샀습니다…', '리딩방 말만 믿었어요…', '유튜브 보다가 그만…'],
    ['단톡방 보고 샀는데 그래도 벌었어요', '소문 듣고 샀는데 운이 좋았네요'],
  ],
  [
    'patience',
    ['못 참고 팔았습니다…', '바닥에서 던졌어요…', '하루만 더 버틸걸…'],
    ['한 번 못 참았지만 그래도 벌었어요', '중간에 던졌는데 다시 올라탔어요'],
  ],
  [
    'courage',
    ['손이 떨려서 못 샀습니다…', '살까 말까 하다 놓쳤어요…', '매수 버튼을 못 누르겠더라고요…'],
    ['한 번 손이 떨렸지만 그래도 벌었어요', '놓친 것도 있지만 남는 장사였어요'],
  ],
]

const CLEAN = {
  bigWin: ['올해는 제가 회사를 먹여 살렸습니다', '차트가 제 편이었어요', '이 맛에 합니다!'],
  win: ['맞혔습니다!', '조금이지만 남겼어요', '계획대로 갔습니다'],
  loss: ['이번엔 틀렸네요…', '시장이 저를 배신했어요…', '다음엔 꼭 맞힐게요…'],
  bigLoss: ['면목이 없습니다…', '올해는 잊고 싶어요…', '할 말이 없습니다…'],
}

const EVEN = '본전입니다. 올해는 쉬어 간 셈이죠.'

/** 판돈의 이만큼(%)을 넘게 벌거나 잃으면 "크게"다. 등급이 내려가는 큰 손실(30%, 221번)과 같다. */
const BIG_PERCENT = 30

/** 같은 상황의 문구 가운데 하나: 직원과 해로 돌린다. */
function pick(lines: string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length]
}

export function bubbleOf(
  flips: Record<string, number>,
  pnl = -1,
  stake = 0,
  seed = 0,
): string | null {
  let best: [string, string[], string[]] | null = null
  let most = 0
  for (const bubble of FLIPPED) {
    const count = flips[bubble[0]] ?? 0
    if (count > most) {
      most = count
      best = bubble
    }
  }
  if (pnl === 0) {
    return best ? EVEN : null
  }
  if (best) {
    return pick(pnl > 0 ? best[2] : best[1], seed)
  }
  const big = stake > 0 && Math.abs(pnl) * 100 >= stake * BIG_PERCENT
  if (pnl > 0) {
    return pick(big ? CLEAN.bigWin : CLEAN.win, seed)
  }
  return pick(big ? CLEAN.bigLoss : CLEAN.loss, seed)
}

/** 전광판·그림의 손익: 만 원 아래는 버리고 부호를 붙인다. +3,068만원, −455만원, +1조 2,000억원. */
export function pnlLabel(pnl: number): string {
  const sign = pnl > 0 ? '+' : pnl < 0 ? '−' : ''
  const text = bigUnits(Math.abs(pnl))
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
