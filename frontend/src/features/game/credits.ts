import type { Game, LogEntry } from '../../api/client'
import { gradeOf } from './grade'
import {
  actionLabelFor,
  childWord,
  percent,
  STAT_KEYS,
  STAT_LABELS,
  sideLabel,
  signedWon,
  statLabel,
  withParticle,
  won,
  yearOf,
} from './labels'
import { nickname } from './nickname'
import { stageFor } from './pixel/bodies'
import { opposite } from './pixel/sexes'
import type { CreditArt, Figure, VignetteKey } from './pixel/vignettes'

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
  /** 장 위에 올리는 도트 그림 (#23). 없으면 글만 */
  art?: CreditArt
}

/** 점수가 붙은 선택 하나. 뉴스 선택은 충격 직후 손익 + 매도로 피한(놓친) 금액, 자유 매매는 실현 손익. */
export interface ScoredDecision {
  age: number
  title: string
  stockName: string
  chosen: string
  actual: string
  score: number
  kind: 'NEWS' | 'SHAKE' | 'TRADE'
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
    if (entry.kind === 'NEWS' || entry.kind === 'SHAKE') {
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
        kind: entry.kind,
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
    if (entry.kind === 'NEWS' || entry.kind === 'SHAKE') {
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
  const flipped = d.chosen !== d.actual ? ` (원래는 ${actionLabelFor(d.kind, d.chosen)})` : ''
  const action =
    d.kind === 'TRADE' ? '자유 매매' : `${actionLabelFor(d.kind, d.actual)} ${d.stockName}`
  return {
    text: `${d.age}세 · ${d.title}`,
    sub: `${action}${flipped} · ${signedWon(d.score)}`,
    tone: d.score > 0 ? 'up' : 'down',
  }
}

function entries(game: Game, ...kinds: LogEntry['kind'][]): LogEntry[] {
  return game.log.filter((e) => kinds.includes(e.kind))
}

const HOME_VIGNETTE: Record<Game['housing']['tenure'], VignetteKey | null> = {
  PARENTS: null,
  MONTHLY: 'oneroom',
  VILLA_JEONSE: 'villa',
  APT_JEONSE: 'apartment',
  OWN: 'apartment',
}

/** 아이가 태어난 장의 키. 아이마다 장이 하나씩이다. */
const CHILD_KEY = 'child-'
const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째']

function childSeq(key: string): number | null {
  if (!key.startsWith(CHILD_KEY)) {
    return null
  }
  const seq = Number(key.slice(CHILD_KEY.length))
  return Number.isInteger(seq) && seq > 0 ? seq : null
}

/**
 * 아이가 태어난 장의 그림: 아기 침대(오른쪽) 옆에 부모가 서고, 먼저 태어난 아이들은 그 왼쪽에 어린이 몸으로 선다. 침대 왼쪽에 자리가 셋(24·12·0)뿐이라
 * 넘치는 사람은 그리지 않는다.
 */
function childArt(game: Game, birth: LogEntry, married: boolean): CreditArt {
  const stage = stageFor(ageOf(game, birth.day))
  const seq = num((birth.payload as Payload).seq)
  const people: Pick<Figure, 'who' | 'sex' | 'stage'>[] = [{ who: 'me', sex: game.sex, stage }]
  if (married) {
    people.push({ who: 'spouse', sex: opposite(game.sex), stage })
  }
  // 먼저 난 아이들은 가계의 순번대로 성별을 가진다.
  for (let i = 1; i < seq; i++) {
    people.push({ who: 'kid', sex: game.household.children[i - 1]?.sex ?? 'M', stage: 'child' })
  }
  const slots = [24, 12, 0]
  const figures: Figure[] = []
  for (const p of people) {
    const x = slots.shift()
    if (x == null) {
      break
    }
    figures.push({ ...p, x })
  }
  return { vignette: 'baby', figures }
}

/**
 * 장마다 하나씩 올리는 도트 그림 (#23). 타고난 것은 아기, 일은 일터, 가족은 결혼한 둘(아이는 태어난 장마다 아기 침대 그림을 따로 가진다), 살아온
 * 집은 마지막 집의 겉모습, 마지막은 창가의 노년(파산이면 비 오는 거리). 사람 위치는 64칸 배경 위 16칸 몸의 왼쪽 열이다.
 */
export function creditArt(game: Game, key: string): CreditArt | undefined {
  const married = game.household.married
  const me = game.sex
  const spouse = opposite(me)
  const seq = childSeq(key)
  if (seq != null) {
    const birth = entries(game, 'CHILD').find((e) => num((e.payload as Payload).seq) === seq)
    return birth ? childArt(game, birth, married) : undefined
  }
  switch (key) {
    case 'born':
      return { vignette: 'nursery', figures: [{ who: 'me', sex: me, stage: 'baby', x: 22 }] }
    case 'work': {
      if (game.fullTimeInvestor) {
        return { vignette: 'studio', figures: [{ who: 'me', sex: me, stage: 'adult', x: 36 }] }
      }
      const worked = game.log.some((e) => e.kind === 'JOB')
      return worked
        ? { vignette: 'office', figures: [{ who: 'me', sex: me, stage: 'adult', x: 38 }] }
        : { vignette: 'street', figures: [{ who: 'me', sex: me, stage: 'adult', x: 18 }] }
    }
    case 'family':
      if (!married) {
        return { vignette: 'studio', figures: [{ who: 'me', sex: me, stage: 'adult', x: 36 }] }
      }
      return {
        vignette: 'family',
        figures: [
          { who: 'me', sex: me, stage: 'adult', x: 14 },
          { who: 'spouse', sex: spouse, stage: 'adult', x: 28 },
        ],
      }
    case 'homes': {
      const vignette = HOME_VIGNETTE[game.housing.tenure]
      if (!vignette) {
        return undefined
      }
      return {
        vignette,
        figures: [
          { who: 'me', sex: me, stage: 'middle', x: 0 },
          ...(married ? [{ who: 'spouse', sex: spouse, stage: 'middle', x: 11 } as const] : []),
        ],
      }
    }
    case 'last':
      if (game.result?.ending === 'BANKRUPT') {
        return { vignette: 'rain', figures: [{ who: 'me', sex: me, stage: 'old', x: 20 }] }
      }
      return {
        vignette: 'home-old',
        figures: [
          { who: 'me', sex: me, stage: 'old', x: 28 },
          ...(married ? [{ who: 'spouse', sex: spouse, stage: 'old', x: 12 } as const] : []),
        ],
      }
    default:
      return undefined
  }
}

export function buildCredits(game: Game): CreditSection[] {
  const result = game.result
  const name = nickname(game.initialStats).name
  const finalAge = result?.finalAge ?? ageOf(game, game.day)
  const bankrupt = result?.ending === 'BANKRUPT'
  const quit = result?.ending === 'QUIT'
  const sections: CreditSection[] = []

  sections.push({
    key: 'title',
    title: `${name}의 투자 인생`,
    lines: [
      { text: `${yearOf(game.startAge)}년 – ${yearOf(finalAge)}년`, tone: 'muted' },
      bankrupt
        ? { text: `${finalAge}세, 파산`, tone: 'down' }
        : quit
          ? { text: `${finalAge}세, 여기서 멈췄다`, tone: 'muted' }
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
        if (p.fullTimeInvestor) {
          return { text: `${age}세, 전업투자자가 됐다`, sub: '월급 없음' }
        }
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

  // 가족: 결혼이 한 장, 아이는 태어날 때마다 한 장씩 그림과 함께 (decisions.md 67번).
  const marriages = entries(game, 'MARRIAGE')
  const births = entries(game, 'CHILD')
  if (marriages.length === 0 && births.length === 0) {
    sections.push({ key: 'family', title: '가족', lines: [{ text: '혼자 살았다', tone: 'muted' }] })
  }
  if (marriages.length > 0) {
    sections.push({
      key: 'family',
      title: '가족',
      lines: marriages.map((e) => ({ text: `${ageOf(game, e.day)}세, 결혼` })),
    })
  }
  // 아이 장에는 태어남 · 독립 · 결혼(비용을 얼마나 대줬는가)이 줄로 쌓인다 (decisions.md 68번).
  const lefts = entries(game, 'CHILD_LEFT')
  const weddings = entries(game, 'CHILD_WEDDING')
  for (const e of births) {
    const seq = num((e.payload as Payload).seq)
    const name = ORDINALS[seq - 1] ?? `${seq}번째`
    // 성별은 기록에 남은 것을 쓴다. 옛 기록엔 없을 수 있다 (decisions.md 69번).
    const word = childWord((e.payload as Payload).sex)
    const lines: CreditLine[] = [
      { text: `${ageOf(game, e.day)}세, ${name} ${withParticle(word, '이', '가')} 태어났다` },
    ]
    const left = lefts.find((l) => num((l.payload as Payload).seq) === seq)
    if (left) {
      lines.push({
        text: `${ageOf(game, left.day)}세, ${name}가 독립했다`,
        sub: `${num((left.payload as Payload).childAge)}살에 집을 나갔다`,
        tone: 'muted',
      })
    }
    const wedding = weddings.find((w) => num((w.payload as Payload).seq) === seq)
    if (wedding) {
      const wp = wedding.payload as Payload
      const cost = num(wp.cost)
      lines.push({
        text: `${ageOf(game, wedding.day)}세, ${name}가 결혼했다`,
        sub:
          cost <= 0
            ? '결혼 비용은 아이가 알아서 마련했다'
            : cost >= num(wp.total)
              ? `결혼 비용 ${won(cost)}을 모두 대줬다`
              : `결혼 비용 ${won(num(wp.total))} 가운데 ${won(cost)}을 보탰다`,
        tone: cost > 0 ? 'down' : undefined,
      })
    }
    sections.push({
      key: `${CHILD_KEY}${seq}`,
      title: word === '아이' ? name : `${name} ${word}`,
      lines,
    })
  }

  const news = entries(game, 'NEWS')
  const shakes = entries(game, 'SHAKE')
  const newsLines: CreditLine[] = []
  if (news.length === 0 && shakes.length === 0) {
    newsLines.push({ text: '투자를 시작하지 않았다', tone: 'muted' })
  } else {
    if (news.length > 0) {
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
    }
    if (shakes.length > 0) {
      const held = shakes.filter((e) => str((e.payload as Payload).actual) === 'HOLD').length
      newsLines.push({
        text: `보유 종목이 ${shakes.length}번 흔들렸다`,
        sub: `버팀 ${held} · 팔았음 ${shakes.length - held}`,
      })
    }
    const deviations = Object.entries(result?.deviationCounts ?? {}).sort(([, a], [, b]) => b - a)
    for (const [code, count] of deviations) {
      newsLines.push({ text: `${statLabel(code)} 부족으로 뒤집힌 선택 ${count}번`, tone: 'down' })
    }
    if (deviations.length === 0) {
      newsLines.push({ text: '한 번도 뒤집히지 않았다', tone: 'accent' })
    }
  }
  sections.push({ key: 'news', title: '뉴스 앞에서', lines: newsLines })

  // 살아온 집: 이사·매수·전세사기·매도 (주거 설계).
  const homeLines: CreditLine[] = entries(game, 'HOUSING', 'HOME_SOLD')
    .filter((e) => {
      const p = e.payload as Payload
      // 넘긴 공고·떨어진 청약은 살아온 집이 아니다.
      return p.option !== 'PASS' && (p.option !== 'APPLY' || p.bought === true)
    })
    .map((e) => {
      const p = e.payload as Payload
      const age = ageOf(game, e.day)
      if (e.kind === 'HOME_SOLD') {
        return {
          text: `${age}세, ${str(p.regionName)} 매도`,
          sub: `${won(num(p.price))} (산 값 ${won(num(p.purchasePrice))})`,
          tone: num(p.price) >= num(p.purchasePrice) ? 'up' : 'down',
        }
      }
      if (p.fraud) {
        return {
          text: `${age}세, 전세사기`,
          sub: `보증금 ${won(num(p.lost))}을 잃었다`,
          tone: 'down',
        }
      }
      if (p.option === 'APPLY') {
        return {
          text: `${age}세, 청약 당첨 · ${str(p.regionName)}`,
          sub: `분양가 ${won(num(p.price))}`,
          tone: 'up',
        }
      }
      return num(p.price) > 0
        ? { text: `${age}세, ${str(p.regionName)} 매수`, sub: won(num(p.price)) }
        : { text: `${age}세, ${str(p.label)}`, sub: `보증금 ${won(num(p.deposit))}` }
    })
  if (homeLines.length > 0) {
    sections.push({ key: 'homes', title: '살아온 집', lines: homeLines })
  }

  // 지나고 나서야 이름이 붙은 위기와, 빠질 때 빚을 얹었는지 (decisions.md 38·39번).
  const stormLines: CreditLine[] = entries(game, 'CRISIS', 'LEVERAGE').map((e) => {
    const p = e.payload as Payload
    const age = ageOf(game, e.day)
    if (e.kind === 'CRISIS') {
      return {
        text: `${num(p.startAge)}~${num(p.endAge)}세, ${str(p.name)} (${p.severity === 'DEPRESSION' ? '대공황' : '불황'})`,
        sub: `주가 평균 ${percent(num(p.dropBp))} 하락 · ${withParticle(str(p.model), '을', '를')} 닮았다`,
        tone: 'down',
      }
    }
    return p.borrowed
      ? { text: `${age}세, ${str(p.stockName)}에 빚투`, sub: `대출 ${won(num(p.loan))}` }
      : { text: `${age}세, ${str(p.stockName)} 급락에도 빚은 지지 않았다`, tone: 'muted' }
  })
  if (stormLines.length > 0) {
    sections.push({ key: 'storms', title: '지나온 폭풍', lines: stormLines })
  }

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
      : quit
        ? {
            text: `${finalAge}세. 자산 ${won(finalAsset)}을 들고 투자에서 손을 뗐다.`,
            tone: 'muted',
          }
        : {
            text: `${finalAge}세. 남은 자산 ${won(finalAsset)}과 매달 연금 ${won(game.household.pension)}으로 여생을 보냈다.`,
            tone: 'accent',
          },
  )
  sections.push({ key: 'last', title: '마지막', lines: lastLines })

  return sections.map((s) => {
    const art = creditArt(game, s.key)
    return art ? { ...s, art } : s
  })
}
