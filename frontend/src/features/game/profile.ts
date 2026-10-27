import type { Game, LogEntry } from '../../api/client'
import { gradeOf } from './grade'
import { STAT_KEYS, STAT_LABELS } from './labels'
import { nickname } from './nickname'

/**
 * 투자 성향 진단 보고서 (decisions.md 61번). 서버가 이미 준 기록만으로 만든다 — 숨은 값은 없다. 세 축(위험 감수·인내·분산)을 0~100으로
 * 매기고, 위험 감수 축으로 금융투자협회식 5단계(안정형~공격투자형)를 붙인다. 문구는 전부 여기서, 숫자는 전부 서버에서.
 *
 * **확률이 끼는 것은 쓰지 않는다** (decisions.md 103번). 모든 수는 능력치 판정 전에 사용자가 고른 행동(chosen)으로 센다. 판정에 뒤집힌 것,
 * 숨은 방향(50:50)에 따른 적중·손익, 랜덤으로 움직이는 가격에 따른 보유 비중·수익률은 성향이 아니다.
 */
export type AxisKey = 'risk' | 'patience' | 'diversification'

export interface Axis {
  key: AxisKey
  name: string
  /** 0~100 */
  score: number
  level: '낮음' | '보통' | '높음'
  /** 점수의 근거가 된 숫자들 */
  evidence: string[]
  /** 전문가 코멘트 */
  comment: string
}

/** 모두 고른 행동으로 센 수. */
export interface ProfileStats {
  newsCount: number
  newsBuy: number
  newsSell: number
  newsHold: number
  shakeCount: number
  shakeHeld: number
  /** 매매창의 자유 매매. 판정이 없다(decisions.md 81번). 집값 마련 매도는 고른 매매가 아니라 뺀다 */
  tradeCount: number
  tradeBuy: number
  tradeSell: number
  leverageOffered: number
  leverageChosen: number
  /** 사기로 고른 종목·섹터 수 (뉴스 매수·빚투·자유 매수) */
  stocksChosen: number
  sectorsChosen: number
  /** 투자 1년당 사고팔기로 고른 횟수 (뉴스 매수·매도 + 자유 매매) */
  tradesPerYear: number
  yearsInvesting: number
}

export interface ProfileReport {
  name: string
  ageYears: number
  investorType: string | null
  startStats: string
  nowStats: string
  grade: { code: string; name: string; description: string }
  axes: Axis[]
  stats: ProfileStats
  summary: string
  recommendations: string[]
}

type Payload = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b)
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

/** 투자 1년에 이만큼 사고팔면 인내 축의 매매 빈도 쪽이 0점이다. 서버 행동 프로필의 profile-full-trades-per-year와 같다. */
const FULL_TRADES_PER_YEAR = 12

/** 금융투자협회 표준 투자자 성향 5단계. 위험 감수 축 점수로 가른다. */
const GRADES = [
  {
    max: 20,
    code: 'STABLE',
    name: '안정형',
    description: '원금 보전을 최우선으로 하며 위험 자산을 거의 쓰지 않는다',
  },
  {
    max: 40,
    code: 'STABLE_PLUS',
    name: '안정추구형',
    description: '손실 위험을 최소화하되 예금보다 나은 수익을 바란다',
  },
  {
    max: 60,
    code: 'NEUTRAL',
    name: '위험중립형',
    description: '수익을 위해 일정 수준의 손실 위험을 받아들인다',
  },
  {
    max: 80,
    code: 'ACTIVE',
    name: '적극투자형',
    description: '높은 수익을 위해 자산 상당 부분의 손실 위험을 감수한다',
  },
  {
    max: 101,
    code: 'AGGRESSIVE',
    name: '공격투자형',
    description: '시장 평균을 크게 넘는 수익을 좇아 큰 손실도 감수한다',
  },
]

function level(score: number): Axis['level'] {
  return score < 40 ? '낮음' : score < 70 ? '보통' : '높음'
}

function statsLine(s: Game['stats']): string {
  return STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${gradeOf(s[k])}(${s[k]})`).join(' · ')
}

function collectStats(game: Game): ProfileStats {
  const s: ProfileStats = {
    newsCount: 0,
    newsBuy: 0,
    newsSell: 0,
    newsHold: 0,
    shakeCount: 0,
    shakeHeld: 0,
    tradeCount: 0,
    tradeBuy: 0,
    tradeSell: 0,
    leverageOffered: 0,
    leverageChosen: 0,
    stocksChosen: 0,
    sectorsChosen: 0,
    tradesPerYear: 0,
    yearsInvesting: 0,
  }
  const sectorOf = new Map(game.market.stocks.map((q) => [q.code, q.sectorName]))
  const chosenStocks = new Set<string>()
  let investingStart: number | null = null

  for (const e of game.log) {
    const p = e.payload as Payload
    const chosen = str(p.chosen)
    switch (e.kind) {
      case 'STYLE':
        investingStart = investingStart ?? e.day
        break
      case 'NEWS':
        s.newsCount++
        if (chosen === 'BUY') {
          s.newsBuy++
          chosenStocks.add(str(p.stockCode))
        } else if (chosen === 'SELL') s.newsSell++
        else s.newsHold++
        break
      case 'SHAKE':
        s.shakeCount++
        if (chosen === 'HOLD') s.shakeHeld++
        break
      case 'TRADE':
        if (p.reason != null) break
        s.tradeCount++
        if (chosen === 'BUY') {
          s.tradeBuy++
          chosenStocks.add(str(p.stockCode))
        } else s.tradeSell++
        break
      case 'LEVERAGE': {
        s.leverageOffered++
        // 빚투 기록에 chosen이 생기기 전(decisions.md 102번)의 판은 빌렸는지로 대신한다.
        const borrow = p.chosen == null ? p.borrowed === true : chosen === 'BORROW'
        if (borrow) {
          s.leverageChosen++
          chosenStocks.add(str(p.stockCode))
        }
        break
      }
      default:
        break
    }
  }

  s.stocksChosen = chosenStocks.size
  s.sectorsChosen = new Set([...chosenStocks].map((c) => sectorOf.get(c) ?? c)).size
  s.yearsInvesting =
    investingStart == null ? 0 : Math.floor((game.day - investingStart) / game.daysPerYear)
  s.tradesPerYear =
    s.yearsInvesting > 0 ? (s.newsBuy + s.newsSell + s.tradeCount) / s.yearsInvesting : 0
  return s
}

function riskAxis(s: ProfileStats): Axis {
  const parts: number[] = []
  const evidence: string[] = []
  if (s.newsCount > 0) {
    parts.push(ratio(s.newsBuy, s.newsCount))
    evidence.push(`뉴스 ${s.newsCount}번 중 사기로 고름 ${s.newsBuy}번`)
  }
  if (s.leverageOffered > 0) {
    parts.push(ratio(s.leverageChosen, s.leverageOffered))
    evidence.push(`빚투 제안 ${s.leverageOffered}번 중 ${s.leverageChosen}번 빌리기로 고름`)
  }
  const score = parts.length > 0 ? clamp(mean(parts) * 100) : 50
  const comment =
    score >= 70
      ? '사고, 빚을 내서라도 더 사는 쪽을 고른다. 수익 기대가 높은 만큼 한 번의 급락이 자산 곡선을 크게 꺾을 수 있다.'
      : score >= 40
        ? '위험을 피하지도 좇지도 않는다. 살 때와 쉴 때를 가려 고른다.'
        : '사는 쪽을 잘 고르지 않는다. 자산을 지키는 데는 유리하지만, 상승장에서 기대 수익을 상당 부분 포기하는 구조다.'
  return { key: 'risk', name: '위험 감수', score, level: level(score), evidence, comment }
}

function patienceAxis(s: ProfileStats): Axis {
  const parts: number[] = []
  const evidence: string[] = []
  if (s.shakeCount > 0) {
    parts.push(ratio(s.shakeHeld, s.shakeCount))
    evidence.push(`보유 종목이 흔들릴 때 ${s.shakeCount}번 중 버티기로 고름 ${s.shakeHeld}번`)
  }
  if (s.yearsInvesting > 0) {
    parts.push(1 - Math.min(1, s.tradesPerYear / FULL_TRADES_PER_YEAR))
    evidence.push(`연평균 사고팔기 ${s.tradesPerYear.toFixed(1)}번 (투자 ${s.yearsInvesting}년)`)
  }
  const score = parts.length > 0 ? clamp(mean(parts) * 100) : 50
  const comment =
    score >= 70
      ? '흔들려도 버티고, 자주 사고팔지 않는다. 흔들림에 팔아 손실을 확정하는 일이 적다.'
      : score >= 40
        ? '대체로 버티지만 단기 소음에 반응해 포지션을 바꾸는 일이 있다.'
        : '흔들릴 때 팔거나 자주 사고판다. 매매가 잦을수록 판단 한 번의 비중은 작아지지만, 실수도 그만큼 자주 쌓인다.'
  return { key: 'patience', name: '인내', score, level: level(score), evidence, comment }
}

function diversificationAxis(s: ProfileStats): Axis {
  const score = clamp(Math.min(60, s.stocksChosen * 10) + Math.min(40, s.sectorsChosen * 10))
  const evidence = [`사기로 고른 종목 ${s.stocksChosen}개 · 섹터 ${s.sectorsChosen}개`]
  const comment =
    score >= 70
      ? '여러 섹터의 종목을 고루 고른다. 한 종목의 악재가 전체를 흔들기 어렵다.'
      : score >= 40
        ? '몇 종목에 기대는 편이다. 확신이 있는 집중이라면 좋지만, 그 종목의 전조를 놓치면 타격이 크다.'
        : '한두 종목만 고른다. 수익도 손실도 그 종목이 결정한다. 섹터를 나누는 것만으로 변동성이 크게 준다.'
  return { key: 'diversification', name: '분산', score, level: level(score), evidence, comment }
}

function summarize(report: Omit<ProfileReport, 'summary' | 'recommendations'>): string {
  const s = report.stats
  const type = report.investorType ? `'${report.investorType}'으로 자란 ` : ''
  if (s.newsCount + s.shakeCount + s.tradeCount + s.leverageOffered === 0) {
    return `${type}${report.name}은(는) 아직 투자 앞에서 고른 것이 없어 진단을 보류한다.`
  }
  const sorted = [...report.axes].sort((a, b) => b.score - a.score)
  const strong = sorted[0]
  const weak = sorted[sorted.length - 1]
  return `${type}${report.name}은(는) ${report.grade.name}(${report.grade.description})에 해당한다. 가장 두드러진 강점은 ${strong.name}(${strong.score}점), 가장 큰 과제는 ${weak.name}(${weak.score}점)이다.`
}

function recommend(axes: Axis[]): string[] {
  const out: string[] = []
  const by = Object.fromEntries(axes.map((a) => [a.key, a])) as Record<AxisKey, Axis>
  if (by.diversification.score < 50) {
    out.push(
      '한 종목에 몰아 사지 말고 섹터를 셋 이상으로 나눠라. 전조를 놓쳐도 한 종목의 급락이 전체를 흔들지 않게 된다.',
    )
  }
  if (by.risk.score >= 75) {
    out.push(
      '빚투와 잦은 매수가 겹치면 급락 한 번에 파산 경로로 들어간다. 빚은 총자산의 20% 아래로, 비상 현금은 생활비 1년치로 유지하라.',
    )
  }
  if (by.risk.score < 30) {
    out.push('사는 쪽을 거의 고르지 않는다. 분할 매수(매달 일정액)로 시장에 머무는 시간을 늘려라.')
  }
  if (by.patience.score < 45) {
    out.push(
      '흔들릴 때 팔거나 자주 사고파는 편이다. 매도 전에 "처음 산 이유가 사라졌는가"를 먼저 물어라.',
    )
  }
  if (out.length === 0) {
    out.push('지금의 규칙을 유지하라. 바꿀 것이 있다면 성과가 아니라 과정(기록·점검 주기)이다.')
  }
  return out.slice(0, 4)
}

export function profileReport(game: Game): ProfileReport {
  const stats = collectStats(game)
  const axes = [riskAxis(stats), patienceAxis(stats), diversificationAxis(stats)]
  const risk = axes[0].score
  const grade = GRADES.find((g) => risk < g.max) ?? GRADES[GRADES.length - 1]
  const base = {
    name: nickname(game.initialStats).name,
    ageYears: game.startAge + Math.floor(game.day / game.daysPerYear),
    investorType: game.investorType?.name ?? null,
    startStats: statsLine(game.initialStats),
    nowStats: statsLine(game.stats),
    grade: { code: grade.code, name: grade.name, description: grade.description },
    axes,
    stats,
  }
  return { ...base, summary: summarize(base), recommendations: recommend(axes) }
}

/** 기록에서 쓰는 종류만 (테스트·디버그용). */
export const PROFILE_KINDS: LogEntry['kind'][] = ['STYLE', 'NEWS', 'SHAKE', 'TRADE', 'LEVERAGE']
