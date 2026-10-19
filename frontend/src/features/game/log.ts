import type { Game, LogEntry, Stats } from '../../api/client'
import { gradeOf } from './grade'
import {
  actionLabel,
  actionLabelFor,
  growthText,
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
 * 인생 기록 한 줄의 문구. 서버는 코드와 숫자만 주고(설계 6.3절) 문구는 여기서 만든다 (설계 5.5절).
 * payload의 키 이름은 서버 진행 도메인과 약속한 것이다.
 */
export type LogTone =
  | 'neutral'
  | 'birth'
  | 'decision'
  | 'flipped'
  | 'growth'
  | 'decline'
  | 'end'
  | 'offer'
  | 'life'

export interface LogLine {
  seq: number
  age: number
  tone: LogTone
  text: string
  pill?: '탄생' | '제안' | '직장' | '세상'
}

type GameInfo = Pick<Game, 'startAge' | 'daysPerYear' | 'initialStats'> &
  Partial<Pick<Game, 'interestSector'>>

interface Deviation {
  statCode: string
  from: string
  to: string
  source?: string | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))

export function logLine(entry: LogEntry, game: GameInfo): LogLine {
  const p = entry.payload as Record<string, unknown>
  const base = { seq: entry.seq, age: game.startAge + Math.floor(entry.day / game.daysPerYear) }

  switch (entry.kind) {
    case 'BIRTH': {
      const stats = (p.stats ?? game.initialStats) as Stats
      const parts = STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${gradeOf(stats[k])} ${stats[k]}`).join(
        ' · ',
      )
      return {
        ...base,
        tone: 'birth',
        pill: '탄생',
        text: `${yearOf(base.age)}년, ${parts}을 타고났다. 별명은 '${nickname(stats).name}'.`,
      }
    }
    case 'TRAIT':
      return {
        ...base,
        tone: 'decision',
        text: `${str(p.eventTitle)} · 결정: ${str(p.optionLabel)}`,
      }
    case 'JOB':
      return {
        ...base,
        tone: 'neutral',
        text: p.fullTimeInvestor
          ? '직장 대신 전업투자자가 됐다. 월급은 없다.'
          : p.rehire
            ? `${str(p.jobTitle)}(으)로 다시 취직했다. 월급 ${won(num(p.monthlySalary))}.`
            : `${str(p.jobTitle)}에 취직했다. 첫 월급 ${won(num(p.monthlySalary))}.`,
      }
    case 'JOB_WAIT':
      return { ...base, tone: 'decision', text: '더 나은 자리를 기다리기로 했다.' }
    case 'CAREER':
      return {
        ...base,
        tone: p.success === false ? 'flipped' : 'decision',
        pill: '직장',
        text: `${str(p.eventTitle)} · ${str(p.optionLabel)} → ${str(p.text)}`,
      }
    case 'STYLE': {
      // 유형 이름이 없는 옛 기록은 스타일 이름으로 대신한다.
      const type = p.investorTypeName ? str(p.investorTypeName) : str(p.styleName)
      const sector = game.interestSector?.name
      return {
        ...base,
        tone: 'neutral',
        text: `'${type}'형 투자자로 자랐다.${sector ? ` 관심 분야는 ${sector}.` : ''}`,
      }
    }
    case 'OFFER':
      return {
        ...base,
        tone: 'offer',
        pill: '제안',
        text: `${str(p.eventTitle)} · ${str(p.optionLabel)}`,
      }
    case 'NEWS': {
      const chosen = str(p.chosen)
      const actual = str(p.actual)
      const deviations = (p.deviations ?? []) as Deviation[]
      if (chosen === actual || deviations.length === 0) {
        return { ...base, tone: 'decision', text: `${str(p.eventTitle)} · ${actionLabel(chosen)}` }
      }
      const cause = deviations.map((d) => `${statLabel(d.statCode)} 부족`).join(', ')
      return {
        ...base,
        tone: 'flipped',
        text: `${str(p.eventTitle)} · 선택 ${actionLabel(chosen)} → 실제 ${actionLabel(actual)} (${cause})`,
      }
    }
    case 'SHAKE': {
      // 보유 종목 흔들림: 버틴다·판다. 뒤집히면 원인 (decisions.md 33번).
      const chosen = str(p.chosen)
      const actual = str(p.actual)
      const deviations = (p.deviations ?? []) as Deviation[]
      const title = `${str(p.eventTitle)}`
      if (chosen === actual || deviations.length === 0) {
        return {
          ...base,
          tone: 'decision',
          text: `${title} · ${actionLabelFor('SHAKE', chosen)}`,
        }
      }
      const cause = deviations.map((d) => `${statLabel(d.statCode)} 부족`).join(', ')
      return {
        ...base,
        tone: 'flipped',
        text: `${title} · 선택 ${actionLabelFor('SHAKE', chosen)} → 실제 ${actionLabelFor('SHAKE', actual)} (${cause})`,
      }
    }
    case 'PRICE': {
      // 종목명이 있으면 종목으로, 없으면(옛 기록) 섹터로 쓴다. 섹터 전체 충격은 덧붙인다.
      const arrow = p.direction === 'UP' ? '▲' : '▼'
      const pnl = num(p.pnl)
      const subject = p.stockName ? str(p.stockName) : str(p.sectorName)
      const wide = p.sectorWide === true && p.stockName ? ` (${str(p.sectorName)} 전체)` : ''
      const tail = pnl === 0 ? '' : ` · 손익 ${signedWon(pnl)}`
      return {
        ...base,
        tone: 'neutral',
        text: `${subject} 주가 ${arrow} ${percent(num(p.changeBp))}${wide}${tail}`,
      }
    }
    case 'TRADE': {
      // 자유 매매. 이탈이면 "못 샀다/못 팔았다"와 원인 (경제 개편 설계 11.5절).
      const side = str(p.side)
      const actual = str(p.actual)
      const deviations = (p.deviations ?? []) as Deviation[]
      if (actual === 'HOLD' || deviations.length > 0) {
        const cause = deviations.map((d) => `${statLabel(d.statCode)} 부족`).join(', ')
        const failed = side === 'SELL' ? '못 팔았다' : '못 샀다'
        return {
          ...base,
          tone: 'flipped',
          text: `${str(p.stockName)} ${sideLabel(side)} → ${failed} (${cause})`,
        }
      }
      if (p.status !== 'EXECUTED') {
        const reason = p.status === 'INSUFFICIENT_CASH' ? '현금 부족' : '보유 없음'
        return {
          ...base,
          tone: 'decision',
          text: `${str(p.stockName)} ${sideLabel(side)} · ${reason}으로 체결되지 않았다`,
        }
      }
      const realized =
        typeof p.realizedPnl === 'number' && p.realizedPnl !== 0
          ? ` · 실현 ${signedWon(p.realizedPnl)}`
          : ''
      return {
        ...base,
        tone: 'decision',
        text: `${str(p.stockName)} ${num(p.quantity)}주 ${sideLabel(side)} (${won(num(p.amount))})${realized}`,
      }
    }
    case 'LIFE':
      return {
        ...base,
        tone: 'life',
        text: `${str(p.title)} · ${signedWon(num(p.amount))}`,
      }
    case 'LEVERAGE':
      return {
        ...base,
        tone: p.borrowed ? 'flipped' : 'decision',
        text: p.borrowed
          ? `${str(p.stockName)}이(가) ${percent(num(p.dropBp))} 빠졌을 때 ${won(num(p.loan))}을 빌려 ${num(p.quantity).toLocaleString('ko-KR')}주를 더 샀다 (빚투).`
          : `${str(p.stockName)}이(가) ${percent(num(p.dropBp))} 빠졌지만 빚은 지지 않았다.`,
      }
    case 'OMEN':
      // 전조는 들린 대로만. 무엇의 전조인지, 정말 전조였는지는 지나 봐야 안다 (decisions.md 38번).
      return { ...base, tone: 'neutral', pill: '세상', text: str(p.text) }
    case 'CRISIS': {
      const kind = p.severity === 'DEPRESSION' ? '대공황' : '불황'
      const omens = Array.isArray(p.omens) ? (p.omens as unknown[]).map(str) : []
      const told =
        omens.length > 0
          ? ` 돌이켜 보면 전조가 있었다: ${omens.map((o) => `"${o}"`).join(' ')}`
          : ' 아무 전조도 없이 왔다.'
      return {
        ...base,
        tone: 'decline',
        pill: '세상',
        text: `돌아보니 ${num(p.startAge)}~${num(p.endAge)}세의 그 시절은 ${str(p.name)}, ${kind}이었다. 주가는 평균 ${percent(num(p.dropBp))} 빠졌다가 회복했다 (${str(p.model)}을 닮았다).${told}`,
      }
    }
    case 'MARRIAGE':
      return { ...base, tone: 'life', text: `결혼했다. 결혼 비용 ${won(num(p.cost))}.` }
    case 'CHILD':
      return { ...base, tone: 'life', text: `${num(p.seq)}번째 아이가 태어났다.` }
    case 'RETIRE':
      return {
        ...base,
        tone: 'life',
        text: `${num(p.age)}세, 은퇴했다. 퇴직금 ${won(num(p.severance))}.`,
      }
    case 'GROWTH':
      return {
        ...base,
        tone: num(p.after) < num(p.before) ? 'decline' : 'growth',
        text: growthText(
          str(p.statCode),
          num(p.before),
          num(p.after),
          typeof p.reason === 'string' ? p.reason : null,
        ),
      }
    case 'END': {
      const bp = num(p.returnBp)
      const money = `${won(num(p.initialAsset))} → ${won(num(p.finalAsset))} (${bp >= 0 ? '+' : ''}${percent(bp)})`
      if (p.ending === 'BANKRUPT') {
        return {
          ...base,
          tone: 'end',
          text: `${num(p.finalAge)}세, 빚 ${won(num(p.debt))}을 갚지 못해 파산했다. ${money}`,
        }
      }
      return {
        ...base,
        tone: 'end',
        text: `${num(p.finalAge)}세, 투자 인생을 마쳤다. ${money}`,
      }
    }
    default:
      // 서버가 먼저 새 종류를 보내도 화면이 죽지 않는다.
      return { ...base, tone: 'neutral', text: String(entry.kind) }
  }
}

/** 최근 순. */
export function logLines(game: Game): LogLine[] {
  return [...game.log].reverse().map((entry) => logLine(entry, game))
}
