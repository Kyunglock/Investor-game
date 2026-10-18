import type { Game, LogEntry, Stats } from '../../api/client'
import {
  actionLabel,
  growthText,
  percent,
  STAT_KEYS,
  STAT_LABELS,
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

export interface LogLine {
  seq: number
  age: number
  tone: LogTone
  text: string
  pill?: '탄생' | '제안'
}

type GameInfo = Pick<Game, 'startAge' | 'daysPerYear' | 'initialStats'> &
  Partial<Pick<Game, 'interestSector'>>

interface Deviation {
  statCode: string
  from: string
  to: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))

export function logLine(entry: LogEntry, game: GameInfo): LogLine {
  const p = entry.payload as Record<string, unknown>
  const base = { seq: entry.seq, age: game.startAge + Math.floor(entry.day / game.daysPerYear) }

  switch (entry.kind) {
    case 'BIRTH': {
      const stats = (p.stats ?? game.initialStats) as Stats
      const parts = STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${stats[k]}`).join(' · ')
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
        text: `${str(p.jobTitle)}에 취직했다. 첫 월급 ${won(num(p.monthlySalary))}.`,
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
    case 'PRICE': {
      const arrow = p.direction === 'UP' ? '▲' : '▼'
      const pnl = num(p.pnl)
      const tail = pnl === 0 ? '' : ` · 손익 ${signedWon(pnl)}`
      return {
        ...base,
        tone: 'neutral',
        text: `${str(p.sectorName)} 주가 ${arrow} ${percent(num(p.changeBp))}${tail}`,
      }
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
      return {
        ...base,
        tone: 'end',
        text: `${num(p.finalAge)}세, 투자 인생을 마쳤다. ${won(num(p.initialAsset))} → ${won(num(p.finalAsset))} (${bp >= 0 ? '+' : ''}${percent(bp)})`,
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
