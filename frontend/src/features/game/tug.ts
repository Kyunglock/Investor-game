import type { Outcome, Stats } from '../../api/client'

/** 맞붙는 두 힘: 내 선택을 밀어주는 능력치와, 그 능력치가 모자랄 때 손을 뒤집는 힘. */
const RIVALS: Record<'courage' | 'patience' | 'conviction', { mine: string; rival: string }> = {
  courage: { mine: '용기', rival: '망설임' },
  patience: { mine: '인내심', rival: '조급함' },
  conviction: { mine: '줏대', rival: '꼬드김' },
}

export interface Matchup {
  stat: keyof typeof RIVALS
  mine: string
  rival: string
  /** 맞붙기 시작할 때 내 쪽이 차지한 몫(%). 능력치가 높을수록 크다 */
  start: number
  /** 내 쪽이 이겼는가 = 고른 대로 됐는가 */
  won: boolean
}

/** 처음 몫은 능력치 그대로 두되, 너무 한쪽으로 쏠려 승부가 뻔해 보이지 않게 20~80% 안에 둔다. */
const MIN_SHARE = 20
const MAX_SHARE = 80

/**
 * 뉴스·흔들림 결과 앞의 맞대결 (decisions.md 181번). 뒤집혔으면 손을 뒤집은 능력치(첫 이탈)의 싸움을, 아니면 고른 행동을 지킨 능력치의 싸움을 보여 준다:
 * 관망(버틴다)은 인내심 vs 조급함, 매수·매도(판다)는 용기 vs 망설임. 승패는 서버 판정(고른 것 = 실제 행동)을 그대로 따른다.
 */
export function matchupFor(outcome: Outcome, stats: Stats): Matchup {
  const won = outcome.chosen === outcome.actual
  const cause = outcome.deviations[0]?.statCode
  const stat: Matchup['stat'] =
    !won && cause && cause in RIVALS
      ? (cause as Matchup['stat'])
      : outcome.chosen === 'HOLD'
        ? 'patience'
        : 'courage'
  const start = Math.min(MAX_SHARE, Math.max(MIN_SHARE, stats[stat]))
  return { stat, ...RIVALS[stat], start, won }
}

/**
 * 막대가 움직이는 순서(내 쪽 몫 %, 시각 ms). 처음엔 밀고 당기다가 마지막에 이긴 쪽으로 쭉 밀린다.
 * 지는 쪽으로 한 번 먼저 기울어 끝까지 모르게 한다.
 */
export function tugSteps(m: Matchup): { share: number; at: number }[] {
  const lean = m.won ? -1 : 1
  return [
    { share: m.start, at: 0 },
    { share: clamp(m.start + 10 * lean), at: 250 },
    { share: clamp(m.start - 8 * lean), at: 550 },
    { share: clamp(m.start + 6 * lean), at: 850 },
    { share: m.won ? 100 : 0, at: 1150 },
  ]
}

const clamp = (v: number) => Math.min(95, Math.max(5, v))
