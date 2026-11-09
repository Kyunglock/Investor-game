import type { CardGrade } from './cards'

/**
 * 카드 펼치기 순서 (decisions.md 393번): 석 장이 뒷면으로 쿵 깔리고, 왼쪽부터 한 장씩 뒤집힌다. 뒤집히기 직전에 카드가 떨리며 빛이 새어 나오고(뜸),
 * 등급이 높을수록 뜸이 길고 펼친 뒤 여운도 길다. 전설은 한참 멈췄다가 터진다. 다 펼친 뒤 READY_GAP_MS가 지나야 고를 수 있다(빨리 두 번 눌러 모르고
 * 고르지 않게). 시각은 모두 카드 고르기가 뜬 때부터의 ms다. 그리는 것은 MentalWindow.tsx의 CardPick과 stage.css.
 */

/** 석 장이 깔리고(0.07초 간격으로 쿵) 화면이 살짝 흔들리기까지. */
export const DEAL_MS = 560
/** 뒤집기 앞 절반(뒷면이 옆으로 눕기까지). 이때 앞면으로 바뀌고 나머지 절반에 앞면이 일어선다. */
export const TURN_MS = 140
/** 다 펼친 뒤, 또는 눌러 건너뛴 뒤 고를 수 있게 되기까지. */
export const READY_GAP_MS = 280

/** 등급마다: 뒤집기 전 떨리는 뜸, 뒤집기 앞 절반, 펼친 뒤 다음 카드까지의 여운. 뒤집히는 속도(turn)는 모든 등급이 같다(#562): 등급 차이는 뜸·여운·연출로만 낸다. */
export const REVEAL_TIMING: Record<CardGrade, { tease: number; turn: number; after: number }> = {
  N: { tease: 150, turn: TURN_MS, after: 130 },
  R: { tease: 300, turn: TURN_MS, after: 260 },
  SR: { tease: 480, turn: TURN_MS, after: 420 },
  UR: { tease: 1100, turn: TURN_MS, after: 700 },
}

export interface RevealStep {
  /** 떨리며 빛이 새기 시작하는 때. */
  tease: number
  /** 옆으로 눕기 시작하는 때. */
  turn: number
  /** 앞면이 보이는 때: 등급 연출(빛·반짝이·빛기둥·폭발)이 이때 터진다. */
  face: number
}

export interface RevealPlan {
  steps: RevealStep[]
  /** 고를 수 있게 되는 때. */
  ready: number
}

export function revealPlan(grades: readonly CardGrade[]): RevealPlan {
  const steps: RevealStep[] = []
  let at = DEAL_MS
  for (const grade of grades) {
    const t = REVEAL_TIMING[grade]
    const step = { tease: at, turn: at + t.tease, face: at + t.tease + t.turn }
    steps.push(step)
    at = step.face + t.after
  }
  const last = steps.at(-1)
  return { steps, ready: (last ? last.face : DEAL_MS) + READY_GAP_MS }
}

/** 가장 높은 등급: 건너뛰어 한 번에 펼칠 때 그 등급의 연출을 한 번만 낸다. */
export function topGrade(grades: readonly CardGrade[]): CardGrade {
  const order: CardGrade[] = ['N', 'R', 'SR', 'UR']
  return grades.reduce<CardGrade>(
    (top, g) => (order.indexOf(g) > order.indexOf(top) ? g : top),
    'N',
  )
}

/** 다 펼쳐 고를 수 있게 된 뒤 이만큼 고르지 않으면 한 장을 저절로 고른다 (#566). 일시정지·앱이 뒤로 간 동안은 세지 않는다. */
export const AUTO_PICK_MS = 5000

/** 저절로 고를 카드의 자리: 등급이 가장 높은 것, 같으면 마법 레벨업 > 고양이 동료 > 일반 카드, 그래도 같으면 왼쪽. */
export function autoPickIndex(cards: readonly { grade: CardGrade; code: string }[]): number {
  const order: CardGrade[] = ['N', 'R', 'SR', 'UR']
  const kind = (code: string) => (code === 'atk' || code === 'spd' ? 0 : code === 'cat' ? 1 : 2)
  let best = 0
  cards.forEach((c, i) => {
    const b = cards[best]
    const g = order.indexOf(c.grade) - order.indexOf(b.grade)
    if (g > 0 || (g === 0 && kind(c.code) > kind(b.code))) best = i
  })
  return best
}
