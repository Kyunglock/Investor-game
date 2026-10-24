import type { Game, LogEntry } from '../../api/client'
import { type ScoredDecision, type StockReturn, scoreDecisions, stockReturns } from './credits'
import { gradeOf } from './grade'
import { percent, STAT_KEYS, STAT_LABELS, signedWon, statLabel, won } from './labels'
import { nickname } from './nickname'

/**
 * 투자 성향 진단 보고서 (decisions.md 61번). 서버가 이미 준 기록·보유·연간 자산만으로 만든다 — 숨은 값은 없다. 다섯 축(위험 감수·규율·판단·인내·분산)을
 * 0~100으로 매기고, 위험 감수 축으로 금융투자협회식 5단계(안정형~공격투자형)를 붙인다. 문구는 전부 여기서, 숫자는 전부 서버에서.
 */
export type AxisKey = 'risk' | 'discipline' | 'judgement' | 'patience' | 'diversification'

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

export interface ProfileStats {
  newsCount: number
  newsBuy: number
  newsSell: number
  newsHold: number
  shakeCount: number
  shakeHeld: number
  tradeCount: number
  tradeBuy: number
  tradeSell: number
  leverageOffered: number
  leverageTaken: number
  /** 뒤집힌 선택(이탈) 수와 원인 능력치별 수 */
  flipped: number
  flippedByStat: Record<string, number>
  /** 방향을 맞힌/틀린 판단 수 (관망은 세지 않는다) */
  correctCalls: number
  wrongCalls: number
  /** 점수가 붙은 선택(뉴스·흔들림·자유 매매) 기준 승률(만분율)과 손익비 */
  decided: number
  winRateBp: number
  avgWin: number
  avgLoss: number
  profitFactor: number | null
  /** 연간 자산 곡선의 최대 낙폭(만분율, 양수) */
  maxDrawdownBp: number
  returnBp: number
  cagrBp: number
  /** 상위 1종목이 투자금에서 차지한 비중(만분율), 현금 비중(만분율) */
  concentrationBp: number
  cashRatioBp: number
  stocksTraded: number
  sectorsTraded: number
  /** 종목별 첫 매수 → 첫 매도(또는 지금)까지의 평균 달 수 */
  avgHoldMonths: number
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
  best: ScoredDecision | null
  worst: ScoredDecision | null
  stocks: StockReturn[]
  summary: string
  recommendations: string[]
}

type Payload = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const BP = 10_000
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
const ratioBp = (a: number, b: number) => (b === 0 ? 0 : Math.round((a * BP) / b))

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

/** 연간 자산 곡선(+ 지금)의 최대 낙폭. 고점 대비 가장 많이 빠진 비율. */
export function maxDrawdownBp(values: number[]): number {
  let peak = Number.NEGATIVE_INFINITY
  let worst = 0
  for (const v of values) {
    if (v > peak) {
      peak = v
    }
    if (peak > 0) {
      worst = Math.max(worst, ratioBp(peak - v, peak))
    }
  }
  return worst
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
    leverageTaken: 0,
    flipped: 0,
    flippedByStat: {},
    correctCalls: 0,
    wrongCalls: 0,
    decided: 0,
    winRateBp: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: null,
    maxDrawdownBp: 0,
    returnBp: 0,
    cagrBp: 0,
    concentrationBp: 0,
    cashRatioBp: 0,
    stocksTraded: 0,
    sectorsTraded: 0,
    avgHoldMonths: 0,
    yearsInvesting: 0,
  }
  const sectorOf = new Map(game.market.stocks.map((q) => [q.code, q.sectorName]))
  const firstBuy = new Map<string, number>()
  const firstSell = new Map<string, number>()
  const traded = new Set<string>()
  const log = game.log
  let investingStart: number | null = null

  const countFlip = (p: Payload) => {
    const deviations = (p.deviations ?? []) as { statCode?: string }[]
    if (deviations.length > 0 && p.chosen !== p.actual) {
      s.flipped++
      for (const d of deviations) {
        const code = str(d.statCode)
        s.flippedByStat[code] = (s.flippedByStat[code] ?? 0) + 1
      }
    }
  }
  const touchTrade = (code: string, actual: string, day: number) => {
    traded.add(code)
    if (actual === 'BUY' && !firstBuy.has(code)) {
      firstBuy.set(code, day)
    }
    if (actual === 'SELL' && firstBuy.has(code) && !firstSell.has(code)) {
      firstSell.set(code, day)
    }
  }

  for (let i = 0; i < log.length; i++) {
    const e = log[i]
    const p = e.payload as Payload
    switch (e.kind) {
      case 'STYLE':
        investingStart = investingStart ?? e.day
        break
      case 'NEWS':
      case 'SHAKE': {
        const actual = str(p.actual)
        if (e.kind === 'NEWS') {
          s.newsCount++
          if (actual === 'BUY') s.newsBuy++
          else if (actual === 'SELL') s.newsSell++
          else s.newsHold++
        } else {
          s.shakeCount++
          if (actual === 'HOLD') s.shakeHeld++
        }
        countFlip(p)
        const trade = (p.trade ?? {}) as Payload
        if (trade.status === 'EXECUTED') {
          touchTrade(str(p.stockCode), actual, e.day)
        }
        // 다음 주가 충격의 방향과 맞췄는가. 관망·버팀은 오르면 맞음, 내리면 틀림으로 본다(들고 있을 때만).
        const price = log.slice(i + 1).find((x) => x.kind === 'PRICE')
        if (price && actual !== 'HOLD') {
          const up = (price.payload as Payload).direction === 'UP'
          if ((actual === 'BUY') === up) s.correctCalls++
          else s.wrongCalls++
        } else if (price && e.kind === 'SHAKE') {
          const up = (price.payload as Payload).direction === 'UP'
          if (up) s.correctCalls++
          else s.wrongCalls++
        }
        break
      }
      case 'TRADE': {
        if (p.status !== 'EXECUTED' || str(p.actual) === 'HOLD') {
          countFlip(p)
          break
        }
        s.tradeCount++
        const actual = str(p.actual)
        if (actual === 'BUY') s.tradeBuy++
        else s.tradeSell++
        touchTrade(str(p.stockCode), actual, e.day)
        break
      }
      case 'LEVERAGE':
        s.leverageOffered++
        if (p.borrowed) s.leverageTaken++
        break
      default:
        break
    }
  }

  const scored = scoreDecisions(game)
  const wins = scored.filter((d) => d.score > 0)
  const losses = scored.filter((d) => d.score < 0)
  s.decided = scored.length
  s.winRateBp = ratioBp(wins.length, scored.length)
  s.avgWin = wins.length ? Math.round(wins.reduce((a, d) => a + d.score, 0) / wins.length) : 0
  s.avgLoss = losses.length
    ? Math.round(losses.reduce((a, d) => a + d.score, 0) / losses.length)
    : 0
  const grossWin = wins.reduce((a, d) => a + d.score, 0)
  const grossLoss = -losses.reduce((a, d) => a + d.score, 0)
  s.profitFactor = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : null

  const curve = [...game.yearly.map((y) => y.totalAsset), game.totalAsset]
  s.maxDrawdownBp = maxDrawdownBp(curve)
  s.returnBp =
    game.initialAsset > 0 ? ratioBp(game.totalAsset - game.initialAsset, game.initialAsset) : 0
  const years = Math.max(1, Math.floor(game.day / game.daysPerYear))
  s.cagrBp =
    game.initialAsset > 0 && game.totalAsset > 0
      ? Math.round(((game.totalAsset / game.initialAsset) ** (1 / years) - 1) * BP)
      : 0
  const invested = game.holdings.reduce((a, h) => a + h.value, 0)
  const top = Math.max(0, ...game.holdings.map((h) => h.value))
  s.concentrationBp = ratioBp(top, invested)
  s.cashRatioBp = ratioBp(Math.max(0, game.cash), Math.max(0, game.cash) + invested)
  s.stocksTraded = traded.size
  s.sectorsTraded = new Set([...traded].map((c) => sectorOf.get(c) ?? c)).size
  const holds = [...firstBuy.entries()].map(
    ([code, day]) => ((firstSell.get(code) ?? game.day) - day) / 30,
  )
  s.avgHoldMonths = holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : 0
  s.yearsInvesting =
    investingStart == null ? 0 : Math.floor((game.day - investingStart) / game.daysPerYear)
  return s
}

function riskAxis(s: ProfileStats, game: Game): Axis {
  let score = 50
  const evidence: string[] = []
  if (s.leverageOffered > 0) {
    const r = s.leverageTaken / s.leverageOffered
    score += Math.round(r * 30) - 5
    evidence.push(`빚투 제안 ${s.leverageOffered}번 중 ${s.leverageTaken}번 수락`)
  }
  if (game.debt > 0) {
    score += 10
    evidence.push(`지금 빚 ${won(game.debt)}`)
  }
  score += Math.round((s.concentrationBp / BP) * 20) - 5
  evidence.push(`상위 1종목 비중 ${percent(s.concentrationBp)}`)
  score += Math.round(((BP - s.cashRatioBp) / BP) * 20) - 10
  evidence.push(`현금 비중 ${percent(s.cashRatioBp)}`)
  if (s.newsCount > 0) {
    const buyRatio = s.newsBuy / s.newsCount
    score += Math.round(buyRatio * 20) - 8
    evidence.push(`뉴스 앞에서 매수 ${s.newsBuy} · 매도 ${s.newsSell} · 관망 ${s.newsHold}`)
  }
  score = clamp(score)
  const comment =
    score >= 70
      ? '손실 가능성을 알면서도 큰 포지션과 빚을 쓰는 편이다. 수익 기대가 높은 만큼 한 번의 급락이 자산 곡선을 크게 꺾을 수 있다.'
      : score >= 40
        ? '위험을 피하지도 좇지도 않는다. 현금과 주식의 균형이 유지되고 있어 급락에도 버틸 여지가 있다.'
        : '위험 노출을 작게 가져간다. 자산을 지키는 데는 유리하지만, 상승장에서 기대 수익을 상당 부분 포기하는 구조다.'
  return { key: 'risk', name: '위험 감수', score, level: level(score), evidence, comment }
}

function disciplineAxis(s: ProfileStats): Axis {
  const decisions = s.newsCount + s.shakeCount + s.tradeCount
  let score = 70
  const evidence: string[] = []
  if (decisions > 0) {
    const flipRatio = s.flipped / decisions
    score -= Math.round(flipRatio * 60)
    evidence.push(
      `선택 ${decisions}번 중 성격에 뒤집힌 선택 ${s.flipped}번 (${percent(ratioBp(s.flipped, decisions))})`,
    )
  }
  if (s.shakeCount > 0) {
    const held = s.shakeHeld / s.shakeCount
    score += Math.round(held * 30) - 10
    evidence.push(
      `보유 종목이 흔들릴 때 버팀 ${s.shakeHeld} · 팔았음 ${s.shakeCount - s.shakeHeld}`,
    )
  }
  const worstStat = Object.entries(s.flippedByStat).sort(([, a], [, b]) => b - a)[0]
  if (worstStat) {
    evidence.push(`가장 자주 발목을 잡은 능력치: ${statLabel(worstStat[0])} (${worstStat[1]}번)`)
  }
  score = clamp(score)
  const comment =
    score >= 70
      ? '정한 대로 실행하는 힘이 강하다. 계획과 실제 행동의 간극이 작아 전략의 결과를 온전히 검증할 수 있다.'
      : score >= 40
        ? '대체로 계획대로 움직이지만 급락·급등 국면에서 감정이 개입한다. 뒤집힌 선택이 어떤 상황에서 나왔는지 돌아볼 만하다.'
        : '선택과 실행이 자주 어긋난다. 전략보다 성격이 손익을 좌우하고 있어, 규칙을 단순하게 두고 미리 정해 두는 쪽이 낫다.'
  return { key: 'discipline', name: '규율', score, level: level(score), evidence, comment }
}

function judgementAxis(s: ProfileStats): Axis {
  let score = 50
  const evidence: string[] = []
  const calls = s.correctCalls + s.wrongCalls
  if (calls > 0) {
    score += Math.round(((s.correctCalls / calls) * 100 - 50) * 0.8)
    evidence.push(
      `방향 판단 ${calls}번 중 적중 ${s.correctCalls}번 (${percent(ratioBp(s.correctCalls, calls))})`,
    )
  }
  if (s.decided > 0) {
    evidence.push(`손익이 붙은 선택 ${s.decided}번 · 승률 ${percent(s.winRateBp)}`)
    if (s.profitFactor != null) {
      score += Math.round(Math.min(20, (s.profitFactor - 1) * 15))
      evidence.push(`손익비(총이익/총손실) ${s.profitFactor}`)
    }
    if (s.avgWin > 0 || s.avgLoss < 0) {
      evidence.push(`평균 이익 ${signedWon(s.avgWin)} · 평균 손실 ${signedWon(s.avgLoss)}`)
    }
  }
  score = clamp(score)
  const comment =
    score >= 70
      ? '방향을 읽는 적중률과 손익비가 모두 양호하다. 안목이 실제 수익으로 이어지고 있다.'
      : score >= 40
        ? '적중률은 동전 던지기보다 조금 나은 수준이다. 이익은 길게, 손실은 짧게 끊는 손익비 관리가 성과를 가른다.'
        : '방향 판단이 자주 빗나간다. 힌트의 신뢰도가 안목에 따라 다르다는 점을 감안해, 확신 없는 뉴스에는 관망이 낫다.'
  return { key: 'judgement', name: '판단', score, level: level(score), evidence, comment }
}

function patienceAxis(s: ProfileStats): Axis {
  let score = 50
  const evidence: string[] = []
  if (s.avgHoldMonths > 0) {
    score += Math.round(Math.min(30, s.avgHoldMonths)) - 10
    evidence.push(`종목당 평균 보유 ${s.avgHoldMonths}달`)
  }
  if (s.shakeCount > 0) {
    score += Math.round((s.shakeHeld / s.shakeCount) * 20) - 8
  }
  if (s.yearsInvesting > 0 && s.tradeCount + s.newsCount > 0) {
    const perYear = (s.tradeCount + s.newsBuy + s.newsSell) / s.yearsInvesting
    score -= Math.round(Math.min(20, perYear * 2))
    evidence.push(`연평균 매매 ${perYear.toFixed(1)}건 (투자 ${s.yearsInvesting}년)`)
  }
  score = clamp(score)
  const comment =
    score >= 70
      ? '한 번 산 종목을 오래 들고 간다. 복리와 세금 면에서 유리하고, 흔들림에 팔아 손실을 확정하는 일이 적다.'
      : score >= 40
        ? '보유 기간이 중간 정도다. 추세를 따라가되, 단기 소음에 반응해 포지션을 바꾸는 일이 있다.'
        : '회전이 빠르다. 매매가 잦을수록 판단 한 번의 비중은 작아지지만, 실수도 그만큼 자주 쌓인다.'
  return { key: 'patience', name: '인내', score, level: level(score), evidence, comment }
}

function diversificationAxis(s: ProfileStats, game: Game): Axis {
  let score = 30
  const evidence: string[] = []
  score += Math.min(30, s.stocksTraded * 6)
  score += Math.min(20, s.sectorsTraded * 7)
  score -= Math.round((s.concentrationBp / BP) * 30)
  evidence.push(`거래한 종목 ${s.stocksTraded}개 · 섹터 ${s.sectorsTraded}개`)
  evidence.push(
    `지금 보유 ${game.holdings.length}종목 · 상위 1종목 비중 ${percent(s.concentrationBp)}`,
  )
  score = clamp(score)
  const comment =
    score >= 70
      ? '종목과 섹터가 고르게 퍼져 있다. 한 종목의 악재가 전체 자산을 흔들기 어렵다.'
      : score >= 40
        ? '몇 종목에 기대는 구조다. 확신이 있는 집중이라면 좋지만, 그 종목의 전조를 놓치면 타격이 크다.'
        : '한두 종목에 자산이 몰려 있다. 수익도 손실도 그 종목이 결정한다. 섹터를 나누는 것만으로 변동성이 크게 준다.'
  return { key: 'diversification', name: '분산', score, level: level(score), evidence, comment }
}

function summarize(report: Omit<ProfileReport, 'summary' | 'recommendations'>): string {
  const sorted = [...report.axes].sort((a, b) => b.score - a.score)
  const strong = sorted[0]
  const weak = sorted[sorted.length - 1]
  const s = report.stats
  const type = report.investorType ? `'${report.investorType}'으로 자란 ` : ''
  const perf =
    s.decided === 0
      ? '아직 손익이 붙은 선택이 없어 성과 평가는 보류한다.'
      : `지금까지 수익률 ${percent(s.returnBp)}(연 ${percent(s.cagrBp)}), 최대 낙폭 ${percent(s.maxDrawdownBp)}, 승률 ${percent(s.winRateBp)}.`
  return `${type}${report.name}은(는) ${report.grade.name}(${report.grade.description})에 해당한다. 가장 두드러진 강점은 ${strong.name}(${strong.score}점), 가장 큰 과제는 ${weak.name}(${weak.score}점)이다. ${perf}`
}

function recommend(axes: Axis[], s: ProfileStats): string[] {
  const out: string[] = []
  const by = Object.fromEntries(axes.map((a) => [a.key, a])) as Record<AxisKey, Axis>
  if (by.discipline.score < 50) {
    out.push(
      '뉴스가 오기 전에 "이 종목은 몇 % 빠지면 판다, 몇 % 오르면 일부 판다"를 적어 두고 그대로 실행하라. 뒤집힌 선택은 대부분 즉흥적 판단에서 나왔다.',
    )
  }
  if (by.diversification.score < 50) {
    out.push(
      '한 종목 비중을 투자금의 30% 아래로 낮추고 섹터를 셋 이상으로 나눠라. 전조를 놓쳐도 한 종목의 급락이 전체를 흔들지 않게 된다.',
    )
  }
  if (by.risk.score >= 75) {
    out.push(
      '빚투와 집중 매수가 겹치면 급락 한 번에 파산 경로로 들어간다. 빚은 총자산의 20% 아래로, 비상 현금은 생활비 1년치로 유지하라.',
    )
  }
  if (by.risk.score < 30) {
    out.push(
      '현금 비중이 높아 상승장을 놓치고 있다. 분할 매수(매달 일정액)로 시장에 머무는 시간을 늘려라.',
    )
  }
  if (by.patience.score < 45) {
    out.push(
      '흔들림 이벤트에서 판 뒤 주가가 회복한 경우가 많다. 매도 전에 "처음 산 이유가 사라졌는가"를 먼저 물어라.',
    )
  }
  if (by.judgement.score < 45) {
    out.push(
      '힌트의 적중률은 안목에 비례한다. 안목이 낮을 때는 확신에 찬 힌트일수록 의심하고, 매매창의 추세 사실(이동평균·고점 대비)을 같이 봐라.',
    )
  }
  if (s.maxDrawdownBp >= 4000) {
    out.push(
      `최대 낙폭이 ${percent(s.maxDrawdownBp)}에 이른다. 자산의 절반을 잃으면 원금 회복에 100% 수익이 필요하다. 낙폭 관리가 수익률보다 먼저다.`,
    )
  }
  if (out.length === 0) {
    out.push('지금의 규칙을 유지하라. 바꿀 것이 있다면 성과가 아니라 과정(기록·점검 주기)이다.')
  }
  return out.slice(0, 4)
}

export function profileReport(game: Game): ProfileReport {
  const stats = collectStats(game)
  const axes = [
    riskAxis(stats, game),
    disciplineAxis(stats),
    judgementAxis(stats),
    patienceAxis(stats),
    diversificationAxis(stats, game),
  ]
  const risk = axes[0].score
  const grade = GRADES.find((g) => risk < g.max) ?? GRADES[GRADES.length - 1]
  const scored = scoreDecisions(game)
  const best = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score > 0 && (!acc || d.score > acc.score) ? d : acc),
    null,
  )
  const worst = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score < 0 && (!acc || d.score < acc.score) ? d : acc),
    null,
  )
  const base = {
    name: nickname(game.initialStats).name,
    ageYears: game.startAge + Math.floor(game.day / game.daysPerYear),
    investorType: game.investorType?.name ?? null,
    startStats: statsLine(game.initialStats),
    nowStats: statsLine(game.stats),
    grade: { code: grade.code, name: grade.name, description: grade.description },
    axes,
    stats,
    best,
    worst,
    stocks: stockReturns(game),
  }
  return { ...base, summary: summarize(base), recommendations: recommend(axes, stats) }
}

/** 기록에서 쓰는 종류만 (테스트·디버그용). */
export const PROFILE_KINDS: LogEntry['kind'][] = [
  'STYLE',
  'NEWS',
  'SHAKE',
  'PRICE',
  'TRADE',
  'LEVERAGE',
]
