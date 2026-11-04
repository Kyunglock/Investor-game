import type { Game, Outcome } from '../../api/client'

type Action = 'BUY' | 'SELL' | 'HOLD'
type StatKey = 'courage' | 'patience' | 'conviction'

/** 막대 한쪽: 행동과 그 행동을 미는 성질 */
export interface Side {
  action: string
  trait: string
}

export interface Matchup {
  /** 내 쪽(고른 행동)을 지키는 능력치 */
  stat: StatKey
  mine: Side
  rival: Side
  /** 맞붙기 시작할 때 내 쪽이 차지한 몫(%). 능력치가 높을수록 크다 */
  start: number
  /** 내 쪽이 이겼는가 = 고른 대로 됐는가 */
  won: boolean
}

/** 처음 몫은 능력치 그대로 두되, 승부가 뻔해 보이지 않게 20~80% 안에 둔다. */
const MIN_SHARE = 20
const MAX_SHARE = 80

const NEWS_ACTIONS: Record<Action, string> = { BUY: '매수한다', SELL: '매도한다', HOLD: '관망한다' }
const SHAKE_ACTIONS: Record<Action, string> = { BUY: '산다', SELL: '판다', HOLD: '버틴다' }

/**
 * 고른 행동이 어느 행동으로 뒤집힐 수 있는지와 그때 맞붙는 성질 (판정 규칙은 서버 behavior.md 4절).
 * 매수·매도 → 관망: 용기 vs 망설임. 관망(버팀) → 매도: 인내심 vs 조급함. 관망 → 매수, 매수 ↔ 매도: 줏대 vs 꼬드김.
 */
function pairOf(from: Action, to: Action): { stat: StatKey; mine: string; rival: string } {
  if (to === 'HOLD') {
    return { stat: 'courage', mine: '용기', rival: '망설임' }
  }
  if (from === 'HOLD' && to === 'SELL') {
    return { stat: 'patience', mine: '인내심', rival: '조급함' }
  }
  return { stat: 'conviction', mine: '줏대', rival: '꼬드김' }
}

/**
 * 뉴스·흔들림 결과 앞의 맞대결 (decisions.md 181번). 막대 한쪽은 고른 행동, 다른 쪽은 그 선택이 뒤집힐 수 있던 행동이다.
 * 뒤집혔으면 실제 행동이 상대이고, 아니면 가장 흔히 뒤집히는 쪽이 상대다: 매수·매도는 관망으로, 관망은 들고 있으면 매도·없으면 매수로.
 * 승패는 서버 판정(고른 것 = 실제 행동)을 그대로 따른다.
 */
export function matchupFor(outcome: Outcome, game: Pick<Game, 'stats' | 'holdings'>): Matchup {
  const chosen = outcome.chosen as Action
  const actual = outcome.actual as Action
  const won = chosen === actual
  const held = game.holdings.some((h) => h.stockCode === outcome.price?.stockCode && h.quantity > 0)
  const rivalAction: Action = !won
    ? actual
    : chosen !== 'HOLD'
      ? 'HOLD'
      : outcome.kind === 'SHAKE' || held
        ? 'SELL'
        : 'BUY'
  const pair = pairOf(chosen, rivalAction)
  const labels = outcome.kind === 'SHAKE' ? SHAKE_ACTIONS : NEWS_ACTIONS
  const start = Math.min(MAX_SHARE, Math.max(MIN_SHARE, game.stats[pair.stat]))
  return {
    stat: pair.stat,
    mine: { action: labels[chosen], trait: pair.mine },
    rival: { action: labels[rivalAction], trait: pair.rival },
    start,
    won,
  }
}

/** 엎치락뒤치락 간격(ms)과 흔들림 폭(%p). 점점 세게 밀고 당긴다. */
const STEP_MS = 210
const SWINGS = [9, 13, 11, 17, 14, 21]

/**
 * 막대가 움직이는 순서(내 쪽 몫 %, 시각 ms). 처음 몫에서 시작해 양쪽으로 점점 크게 밀고 당기다가, 마지막 흔들림은 지는 쪽이 거의
 * 이길 듯이 밀어붙이고, 그다음 이긴 쪽이 끝까지 쭉 민다.
 */
export function tugSteps(m: Matchup): { share: number; at: number }[] {
  // 마지막 흔들림이 지는 쪽으로 가도록 방향을 맞춘다.
  const toLoser = m.won ? -1 : 1
  const first = SWINGS.length % 2 === 0 ? -toLoser : toLoser
  const steps = [{ share: m.start, at: 0 }]
  SWINGS.forEach((swing, i) => {
    const dir = i % 2 === 0 ? first : -first
    steps.push({ share: clamp(m.start + dir * swing), at: (i + 1) * STEP_MS })
  })
  steps.push({ share: m.won ? 100 : 0, at: (SWINGS.length + 1) * STEP_MS + 120 })
  return steps
}

const clamp = (v: number) => Math.min(92, Math.max(8, v))
