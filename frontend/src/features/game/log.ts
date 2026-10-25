import type { Game, LogEntry, Stats } from '../../api/client'
import { gradeOf } from './grade'
import {
  actionLabel,
  actionLabelFor,
  childWord,
  growthText,
  percent,
  STAT_KEYS,
  STAT_LABELS,
  sideLabel,
  signedWon,
  statLabel,
  TRIP_LABELS,
  withParticle,
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
  pill?: '탄생' | '제안' | '직장' | '투자' | '세상' | '집'
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

const CHILD_NAMES = ['첫째', '둘째', '셋째', '넷째', '다섯째']

/** 자녀 순번을 부르는 말 (decisions.md 68번). */
export function childName(seq: number): string {
  return CHILD_NAMES[seq - 1] ?? `${seq}번째`
}

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
      // 결과가 갈리는 선택(빌려준 돈)은 어떻게 됐는지 덧붙인다 (decisions.md 41번).
      return {
        ...base,
        tone: 'decision',
        text: `${str(p.eventTitle)} · 결정: ${str(p.optionLabel)}${p.result ? ` → ${str(p.result)}` : ''}${typeof p.amount === 'number' && p.amount !== 0 ? ` · ${signedWon(p.amount)}` : ''}`,
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
        pill: p.fullTimeInvestor ? '투자' : '직장',
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
      // 가족 여행은 선택이라 어떻게 갔는지(또는 안 갔는지)가 남는다 (decisions.md 71번).
      if (p.noticeCode === 'family-trip' && typeof p.option === 'string') {
        if (p.option === 'none') {
          return { ...base, tone: 'life', text: `${str(p.proposer)}의 여행 제안을 거절했다.` }
        }
        return {
          ...base,
          tone: 'life',
          text: `가족 여행 (${TRIP_LABELS[p.option] ?? p.option}) · ${signedWon(num(p.amount))}`,
        }
      }
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
    case 'HOUSING': {
      // 주거 선택 (주거 설계 4절). 전세사기는 고른 뒤에 드러난다.
      const lost = num(p.lost)
      // 집주인이 재계약을 거절한 만기에는 2년 더 살 수 없어 옮겼다 (#25).
      const refused =
        p.definition === 'lease-refused' ? '집주인이 재계약을 거절해 집을 옮겼다. ' : ''
      const head = `${refused}${p.fraud ? `전세사기를 당했다. 보증금 ${won(lost)}을 돌려받지 못했다. ` : ''}`
      const option = str(p.option)
      if (option === 'APPLY') {
        // 청약 (decisions.md 42번): 떨어짐 / 당첨됐지만 돈이 없어 포기 / 당첨돼 분양가로 삼.
        const text = !p.won
          ? `청약에 떨어졌다 (가점 ${num(p.points)}점).`
          : p.bought
            ? `청약에 당첨됐다 (가점 ${num(p.points)}점)! ${str(p.regionName)}를 분양가 ${won(num(p.price))}에 샀다.`
            : `청약에 당첨됐지만 계약금이 모자라 포기했다 (가점 ${num(p.points)}점).`
        return { ...base, tone: p.bought ? 'growth' : 'life', pill: '집', text }
      }
      const what =
        option === 'PASS'
          ? '집은 아직 사지 않기로 했다.'
          : num(p.price) > 0
            ? `${str(p.regionName)}를 ${won(num(p.price))}에 샀다${num(p.mortgage) > 0 ? ` (주담대 ${won(num(p.mortgage))})` : ''}.`
            : `${str(p.label)} · 보증금 ${won(num(p.deposit))}${num(p.monthlyRent) > 0 ? `, 월세 ${won(num(p.monthlyRent))}` : ''}${num(p.jeonseLoan) > 0 ? `, 전세대출 ${won(num(p.jeonseLoan))}` : ''}.`
      return { ...base, tone: p.fraud ? 'flipped' : 'life', pill: '집', text: `${head}${what}` }
    }
    case 'MORTGAGE_REPAY':
      // 주담대 일시 상환 (decisions.md 58번).
      return {
        ...base,
        tone: 'life',
        pill: '집',
        text: `${str(p.regionName)} 주담대 ${won(num(p.amount))}을 한꺼번에 갚았다. 남은 주담대 ${won(num(p.remaining))}.`,
      }
    case 'HOME_SOLD': {
      const gain = num(p.price) - num(p.purchasePrice)
      return {
        ...base,
        tone: 'life',
        pill: '집',
        text: `${str(p.regionName)}가 ${won(num(p.price))}에 팔렸다 (산 값 ${won(num(p.purchasePrice))}, ${signedWon(gain)}).${p.residence ? ' 살 곳을 새로 구해야 한다.' : ''}`,
      }
    }
    case 'TENANT': {
      const diff = num(p.after) - num(p.before)
      return {
        ...base,
        tone: diff < 0 ? 'decline' : 'life',
        pill: '집',
        text:
          diff < 0
            ? `${str(p.regionName)} 세입자가 바뀌었다. 전세가가 내려 ${won(-diff)}을 돌려줬다 (역전세).`
            : `${str(p.regionName)} 세입자가 바뀌었다. 전세가가 올라 보증금 ${won(diff)}을 더 받았다.`,
      }
    }
    case 'OMEN':
    case 'ARTICLE':
      // 전조는 들린 대로만. 무엇의 전조인지, 정말 전조였는지는 지나 봐야 안다 (decisions.md 38번).
      // 평범한 기사와 헛소문도 전조와 똑같이 보여 서로 구분되지 않는다 (매매창 설계 3.3절).
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
      // 성별은 기록에 남은 것을 쓴다. 옛 기록엔 없을 수 있다 (decisions.md 69번).
      return {
        ...base,
        tone: 'life',
        text: `${childName(num(p.seq))} ${withParticle(childWord(p.sex), '이', '가')} 태어났다.`,
      }
    case 'CHILD_LEFT':
      // 자녀 독립 (decisions.md 68번). 이달부터 양육비가 들지 않는다.
      return {
        ...base,
        tone: 'life',
        text: `${childName(num(p.seq))}가 ${num(p.childAge)}살에 독립해 집을 나갔다. 생활비가 ${won(num(p.expense))}으로 줄었다.`,
      }
    case 'CHILD_WEDDING': {
      // 자녀 결혼 (decisions.md 68번): 결혼 비용 가운데 얼마를 대줬는가.
      const total = num(p.total)
      const cost = num(p.cost)
      const paid =
        cost <= 0
          ? `결혼 비용 ${won(total)}은 아이가 알아서 마련했다.`
          : cost >= total
            ? `결혼 비용 ${won(total)}을 모두 대줬다.`
            : `결혼 비용 ${won(total)} 가운데 ${won(cost)}을 보탰다.`
      return { ...base, tone: 'life', text: `${childName(num(p.seq))}가 결혼했다. ${paid}` }
    }
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
      if (p.ending === 'QUIT') {
        return {
          ...base,
          tone: 'end',
          text: `${num(p.finalAge)}세, 투자 인생을 여기서 멈췄다. ${money}`,
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

/** 기본은 최근 순(진행 화면). 끝난 인생을 되돌아보는 기록부는 `oldest`로 시간순 (#22). */
export function logLines(game: Game, order: 'recent' | 'oldest' = 'recent'): LogLine[] {
  const entries = order === 'recent' ? [...game.log].reverse() : game.log
  return entries.map((entry) => logLine(entry, game))
}
