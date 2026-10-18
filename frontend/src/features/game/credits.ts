import type { Game, LogEntry } from '../../api/client'
import { gradeOf } from './grade'
import {
  actionLabel,
  percent,
  STAT_KEYS,
  STAT_LABELS,
  sideLabel,
  signedWon,
  statLabel,
  won,
  yearOf,
} from './labels'
import { nickname } from './nickname'

/**
 * 엔딩 크레딧의 재료 (엔딩 설계 3절). 서버가 이미 준 기록·보유·결과·가계만으로 만든다. 문구는 여기서, 숫자는 서버에서.
 */
export type CreditTone = 'up' | 'down' | 'muted' | 'accent'

export interface CreditLine {
  text: string
  sub?: string
  tone?: CreditTone
}

export interface CreditSection {
  key: string
  title: string
  lines: CreditLine[]
}

/** 점수가 붙은 선택 하나. 뉴스 선택은 충격 직후 손익 + 매도로 피한(놓친) 금액, 자유 매매는 실현 손익. */
export interface ScoredDecision {
  age: number
  title: string
  stockName: string
  chosen: string
  actual: string
  score: number
  kind: 'NEWS' | 'TRADE'
}

/** 종목 하나의 투입·회수. 회수에는 아직 들고 있는 평가액이 들어간다. */
export interface StockReturn {
  stockCode: string
  stockName: string
  invested: number
  recovered: number
  pnl: number
  pnlBp: number
}

type Payload = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))
const BP = 10_000

function ageOf(game: Game, day: number): number {
  return game.startAge + Math.floor(day / game.daysPerYear)
}

function signedPercent(bp: number): string {
  return `${bp >= 0 ? '+' : ''}${percent(bp)}`
}

export function scoreDecisions(game: Game): ScoredDecision[] {
  const out: ScoredDecision[] = []
  const log = game.log
  for (let i = 0; i < log.length; i++) {
    const entry = log[i]
    const p = entry.payload as Payload
    if (entry.kind === 'NEWS') {
      const price = log.slice(i + 1).find((e) => e.kind === 'PRICE')
      if (!price) {
        continue
      }
      const pp = price.payload as Payload
      const signed = pp.direction === 'UP' ? num(pp.changeBp) : -num(pp.changeBp)
      const trade = (p.trade ?? {}) as Payload
      const sold = p.actual === 'SELL' && trade.status === 'EXECUTED' ? num(trade.amount) : 0
      // 팔았으면 그 돈은 충격을 비켜 갔다. 내릴 뉴스면 피한 손실(+), 오를 뉴스면 놓친 이익(−).
      const score = num(pp.pnl) - Math.round((sold * signed) / BP)
      if (score === 0) {
        continue
      }
      out.push({
        age: ageOf(game, entry.day),
        title: str(p.eventTitle),
        stockName: str(p.stockName),
        chosen: str(p.chosen),
        actual: str(p.actual),
        score,
        kind: 'NEWS',
      })
    } else if (entry.kind === 'TRADE') {
      const realized = num(p.realizedPnl)
      if (p.status !== 'EXECUTED' || realized === 0) {
        continue
      }
      out.push({
        age: ageOf(game, entry.day),
        title: `${str(p.stockName)} ${sideLabel(str(p.actual))}`,
        stockName: str(p.stockName),
        chosen: str(p.chosen ?? p.side),
        actual: str(p.actual),
        score: realized,
        kind: 'TRADE',
      })
    }
  }
  return out
}

export function stockReturns(game: Game): StockReturn[] {
  const byCode = new Map<string, StockReturn>()
  const touch = (code: string, name: string) => {
    let s = byCode.get(code)
    if (!s) {
      s = { stockCode: code, stockName: name, invested: 0, recovered: 0, pnl: 0, pnlBp: 0 }
      byCode.set(code, s)
    }
    return s
  }
  const apply = (code: string, name: string, actual: string, amount: number) => {
    const s = touch(code, name)
    if (actual === 'BUY') {
      s.invested += amount
    } else if (actual === 'SELL') {
      s.recovered += amount
    }
  }
  for (const entry of game.log) {
    const p = entry.payload as Payload
    if (entry.kind === 'NEWS') {
      const trade = (p.trade ?? {}) as Payload
      if (trade.status === 'EXECUTED') {
        apply(str(p.stockCode), str(p.stockName), str(p.actual), num(trade.amount))
      }
    } else if (entry.kind === 'TRADE' && p.status === 'EXECUTED') {
      apply(str(p.stockCode), str(p.stockName), str(p.actual), num(p.amount))
    }
  }
  for (const h of game.holdings) {
    touch(h.stockCode, h.stockName).recovered += h.value
  }
  const list = [...byCode.values()].filter((s) => s.invested > 0)
  for (const s of list) {
    s.pnl = s.recovered - s.invested
    s.pnlBp = Math.round((s.pnl * BP) / s.invested)
  }
  return list.sort((a, b) => b.pnlBp - a.pnlBp)
}

function decisionLine(d: ScoredDecision): CreditLine {
  const flipped = d.chosen !== d.actual ? ` (원래는 ${actionLabel(d.chosen)})` : ''
  const action = d.kind === 'NEWS' ? `${actionLabel(d.actual)} ${d.stockName}` : '자유 매매'
  return {
    text: `${d.age}세 · ${d.title}`,
    sub: `${action}${flipped} · ${signedWon(d.score)}`,
    tone: d.score > 0 ? 'up' : 'down',
  }
}

function entries(game: Game, ...kinds: LogEntry['kind'][]): LogEntry[] {
  return game.log.filter((e) => kinds.includes(e.kind))
}

export function buildCredits(game: Game): CreditSection[] {
  const result = game.result
  const name = nickname(game.initialStats).name
  const finalAge = result?.finalAge ?? ageOf(game, game.day)
  const bankrupt = result?.ending === 'BANKRUPT'
  const sections: CreditSection[] = []

  sections.push({
    key: 'title',
    title: `${name}의 투자 인생`,
    lines: [
      { text: `${yearOf(game.startAge)}년 – ${yearOf(finalAge)}년`, tone: 'muted' },
      bankrupt
        ? { text: `${finalAge}세, 파산`, tone: 'down' }
        : { text: `${finalAge}세, 은퇴 후 연금 생활`, tone: 'accent' },
    ],
  })

  sections.push({
    key: 'born',
    title: '타고난 것',
    lines: [
      {
        text: STAT_KEYS.map(
          (k) => `${STAT_LABELS[k]} ${gradeOf(game.initialStats[k])} ${game.initialStats[k]}`,
        ).join(' · '),
      },
      { text: `초기 자산 ${won(game.initialAsset)}`, tone: 'muted' },
    ],
  })

  const traitLines: CreditLine[] = entries(game, 'TRAIT').map((e) => {
    const p = e.payload as Payload
    return { text: `${ageOf(game, e.day)}세 · ${str(p.eventTitle)}`, sub: str(p.optionLabel) }
  })
  sections.push({
    key: 'traits',
    title: '성향',
    lines: [
      game.investorType
        ? { text: game.investorType.name, sub: game.investorType.description, tone: 'accent' }
        : { text: '성향이 정해지기 전에 끝났다', tone: 'muted' },
      ...traitLines,
    ],
  })

  const workLines: CreditLine[] = entries(game, 'JOB', 'JOB_WAIT', 'CAREER', 'RETIRE').map((e) => {
    const p = e.payload as Payload
    const age = ageOf(game, e.day)
    switch (e.kind) {
      case 'JOB':
        return {
          text: `${age}세, ${str(p.jobTitle)}${p.rehire ? '(으)로 다시 취직' : '에 취직'}`,
          sub: `월급 ${won(num(p.monthlySalary))}`,
        }
      case 'JOB_WAIT':
        return { text: `${age}세, 더 나은 자리를 기다렸다`, tone: 'muted' }
      case 'CAREER':
        return {
          text: `${age}세 · ${str(p.eventTitle)}`,
          sub: `${str(p.optionLabel)} → ${str(p.text)}`,
          tone: p.success === false ? 'down' : undefined,
        }
      default:
        return { text: `${age}세, 은퇴`, sub: `퇴직금 ${won(num(p.severance))}` }
    }
  })
  sections.push({
    key: 'work',
    title: '일',
    lines: workLines.length > 0 ? workLines : [{ text: '직업을 갖지 못했다', tone: 'muted' }],
  })

  const familyLines: CreditLine[] = entries(game, 'MARRIAGE', 'CHILD').map((e) => {
    const p = e.payload as Payload
    const age = ageOf(game, e.day)
    return e.kind === 'MARRIAGE'
      ? { text: `${age}세, 결혼` }
      : { text: `${age}세, ${num(p.seq)}번째 아이가 태어났다` }
  })
  sections.push({
    key: 'family',
    title: '가족',
    lines: familyLines.length > 0 ? familyLines : [{ text: '혼자 살았다', tone: 'muted' }],
  })

  const news = entries(game, 'NEWS')
  const newsLines: CreditLine[] = []
  if (news.length === 0) {
    newsLines.push({ text: '투자를 시작하지 않았다', tone: 'muted' })
  } else {
    const counts = { BUY: 0, SELL: 0, HOLD: 0 }
    for (const e of news) {
      const actual = str((e.payload as Payload).actual) as keyof typeof counts
      if (actual in counts) {
        counts[actual]++
      }
    }
    newsLines.push({
      text: `뉴스 ${news.length}번 앞에 섰다`,
      sub: `매수 ${counts.BUY} · 매도 ${counts.SELL} · 관망 ${counts.HOLD}`,
    })
    const deviations = Object.entries(result?.deviationCounts ?? {}).sort(([, a], [, b]) => b - a)
    for (const [code, count] of deviations) {
      newsLines.push({ text: `${statLabel(code)} 부족으로 뒤집힌 선택 ${count}번`, tone: 'down' })
    }
    if (deviations.length === 0) {
      newsLines.push({ text: '한 번도 뒤집히지 않았다', tone: 'accent' })
    }
  }
  sections.push({ key: 'news', title: '뉴스 앞에서', lines: newsLines })

  const scored = scoreDecisions(game)
  const best = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score > 0 && (!acc || d.score > acc.score) ? d : acc),
    null,
  )
  const worst = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score < 0 && (!acc || d.score < acc.score) ? d : acc),
    null,
  )
  if (best) {
    sections.push({ key: 'best', title: '가장 잘한 선택', lines: [decisionLine(best)] })
  }
  if (worst) {
    sections.push({ key: 'worst', title: '가장 아쉬운 선택', lines: [decisionLine(worst)] })
  }

  const stocks = stockReturns(game)
  if (stocks.length > 0) {
    sections.push({
      key: 'stocks',
      title: '산 주식들',
      lines: stocks.map((s) => ({
        text: s.stockName,
        sub: `${signedWon(s.pnl)} (${signedPercent(s.pnlBp)}) · 투입 ${won(s.invested)}`,
        tone: s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : 'muted',
      })),
    })
  }

  const finalAsset = result?.finalAsset ?? game.totalAsset
  const returnBp = result?.returnBp ?? 0
  const lastLines: CreditLine[] = [
    { text: `${won(game.initialAsset)} → ${won(finalAsset)}` },
    { text: signedPercent(returnBp), tone: returnBp >= 0 ? 'up' : 'down' },
  ]
  lastLines.push(
    bankrupt
      ? { text: `${finalAge}세. 빚 ${won(game.debt)}을 갚지 못해 파산했다.`, tone: 'down' }
      : {
          text: `${finalAge}세. 남은 자산 ${won(finalAsset)}과 매달 연금 ${won(game.household.pension)}으로 여생을 보냈다.`,
          tone: 'accent',
        },
  )
  sections.push({ key: 'last', title: '마지막', lines: lastLines })

  return sections
}
