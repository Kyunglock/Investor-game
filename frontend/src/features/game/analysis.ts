import type { Game, LogEntry } from '../../api/client'
import { actionLabelFor, percent, sideLabel } from './labels'

/** 매매창의 순수 계산 (매매창 설계 2절). 해석의 확률·정답은 서버에 있고 여기에는 표시용 계산만 있다. */

/** 이동평균. 앞쪽은 있는 만큼으로 평균한다(서버의 ma6·ma12와 같은 방식). */
export function movingAverage(values: number[], window: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) {
      sum -= values[i - window]
    }
    out.push(sum / Math.min(i + 1, window))
  }
  return out
}

/** 안목 점수를 10칸 눈금으로. 확률은 보여 주지 않는다 (매매창 설계 4.3절). */
export function insightGauge(insight: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(insight / 10)))
  return '●'.repeat(filled) + '○'.repeat(10 - filled)
}

const READING_LABELS: Record<string, string> = {
  UP: '상승',
  DOWN: '하락',
  FLAT: '횡보',
  HOT: '과열',
  STABLE: '안정',
  COLD: '위축',
}

export function readingLabel(code: string): string {
  return READING_LABELS[code] ?? code
}

export interface StockNewsItem {
  seq: number
  month: number
  age: number
  kind: 'NEWS' | 'SHAKE' | 'PRICE' | 'TRADE' | 'LEVERAGE'
  text: string
}

/**
 * 한 종목에 얽힌 기록: 뉴스·흔들림(내 선택과 실제), 주가 충격, 내 매매, 빚투. 인생 기록에서 종목 코드로 모은다 (매매창 설계 2.1절). 최근 순.
 */
export function stockNews(
  game: Pick<Game, 'log' | 'startAge' | 'daysPerYear'>,
  stockCode: string,
): StockNewsItem[] {
  const items: StockNewsItem[] = []
  const daysPerMonth = game.daysPerYear / 12
  for (const entry of game.log) {
    const p = entry.payload as Record<string, unknown>
    if (p.stockCode !== stockCode) {
      continue
    }
    const text = stockNewsText(entry, p)
    if (text) {
      items.push({
        seq: entry.seq,
        month: Math.floor(entry.day / daysPerMonth),
        age: game.startAge + Math.floor(entry.day / game.daysPerYear),
        kind: entry.kind as StockNewsItem['kind'],
        text,
      })
    }
  }
  return items.reverse()
}

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))

function stockNewsText(entry: LogEntry, p: Record<string, unknown>): string | null {
  switch (entry.kind) {
    case 'NEWS':
    case 'SHAKE': {
      const chosen = str(p.chosen)
      const actual = str(p.actual)
      const label = (code: string) => actionLabelFor(entry.kind, code)
      return chosen === actual
        ? `${str(p.eventTitle)} · 나: ${label(chosen)}`
        : `${str(p.eventTitle)} · 나: ${label(chosen)} → 실제 ${label(actual)}`
    }
    case 'PRICE':
      return `주가 ${p.direction === 'UP' ? '▲' : '▼'} ${percent(num(p.changeBp))}${p.sectorWide ? ' (섹터 전체)' : ''}`
    case 'TRADE': {
      const side = str(p.side)
      const actual = str(p.actual)
      if (actual === 'HOLD' || p.status !== 'EXECUTED') {
        return `${sideLabel(side)} 주문 → 못 ${side === 'SELL' ? '팔았다' : '샀다'}`
      }
      return `${sideLabel(side)} ${num(p.quantity).toLocaleString('ko-KR')}주 @ ${num(p.price).toLocaleString('ko-KR')}`
    }
    case 'LEVERAGE':
      return p.borrowed
        ? `빚투 · ${num(p.quantity).toLocaleString('ko-KR')}주 추가 매수`
        : '빚투 제안 · 거절'
    default:
      return null
  }
}

/** 차트에 찍을 사건의 달. 뉴스·흔들림·내 매매만 (주가 충격은 뉴스와 같은 달이라 겹친다). */
export type MarkerKind = 'NEWS' | 'SHAKE' | 'TRADE'

export function newsMarkers(items: StockNewsItem[]): { month: number; kind: MarkerKind }[] {
  const markers: { month: number; kind: MarkerKind }[] = []
  for (const item of items) {
    if (item.kind === 'NEWS' || item.kind === 'SHAKE' || item.kind === 'TRADE') {
      markers.push({ month: item.month, kind: item.kind })
    }
  }
  return markers
}

/** 지표 값의 표기. unit은 서버 계약(MarketOverview.indicators[].unit)을 따른다. */
export function indicatorValue(unit: string, value: number): string {
  switch (unit) {
    case 'bp':
      return `${(value / 100).toFixed(1)}%`
    case 'won':
      return `${value.toLocaleString('ko-KR')}원`
    case 'score':
      return String(value)
    case 'ratio':
      return `평소의 ${Math.round(value / 100)}%`
    default:
      return value.toLocaleString('ko-KR')
  }
}

/** 1년 변화의 표기. 금리·증가율(bp)은 %p 차이, 나머지는 비율. */
export function indicatorChange(unit: string, value: number, yearAgo: number): string {
  if (unit === 'bp') {
    const diff = (value - yearAgo) / 100
    return `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toFixed(1)}%p`
  }
  if (unit === 'score') {
    const diff = value - yearAgo
    return `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`
  }
  if (yearAgo <= 0) {
    return '—'
  }
  const bp = Math.trunc(((value - yearAgo) * 10_000) / yearAgo)
  return `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${(Math.abs(bp) / 100).toFixed(1)}%`
}

/** 뉴스 카드의 세계 시황에 보일 지표 코드. 이 순서대로, 없는 코드는 건너뛴다 (decisions.md 79번). */
export const BRIEF_INDICATORS = ['index', 'mortgage', 'cpi', 'fx', 'sentiment']

/** 세계 시황 다섯 줄: 선호 코드 순으로 고르고, 모자라면 나머지 지표로 채운다. */
export function briefIndicators<T extends { code: string }>(indicators: T[], count = 5): T[] {
  const byCode = new Map(indicators.map((i) => [i.code, i]))
  const picked: T[] = []
  for (const code of BRIEF_INDICATORS) {
    const found = byCode.get(code)
    if (found && picked.length < count) {
      picked.push(found)
    }
  }
  for (const i of indicators) {
    if (picked.length >= count) {
      break
    }
    if (!picked.includes(i)) {
      picked.push(i)
    }
  }
  return picked
}
