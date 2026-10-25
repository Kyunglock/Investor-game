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
  /** 장 위에 올리는 도트 그림 (#23). 시간순 장은 그림이 붙는 순간마다 시작된다. 없으면 글만 */
  art?: CreditArt
}

/** 점수가 붙은 선택 하나. 뉴스 선택은 충격 직후 손익 + 매도로 피한(놓친) 금액, 자유 매매는 실현 손익. */
export interface ScoredDecision {
  /** 기록 번호. 시간순 크레딧에서 그 자리를 찾는 데 쓴다 */
  seq: number
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
        seq: entry.seq,
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
        seq: entry.seq,
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

/** 이사·매수 선택지 → 집의 겉모습. 그림이 없는 선택지(넘김·사기 등)는 null. */
const HOME_VIGNETTE: Record<string, VignetteKey> = {
  MONTHLY: 'oneroom',
  VILLA: 'villa',
  VILLA_INSURED: 'villa',
  APT_JEONSE: 'apartment',
  BUY_SEOUL: 'apartment',
  BUY_GYEONGGI: 'apartment',
  GAP: 'apartment',
  APPLY: 'apartment',
}

const ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째']

/** 그 날까지 결혼했는가. 크레딧은 시간순이라 그림 속 가족도 그때 기준이다. */
function marriedBy(game: Game, day: number): boolean {
  return entries(game, 'MARRIAGE').some((e) => e.day <= day)
}

/** 나(+그때 결혼했으면 배우자)만 서는 그림. */
function coupleArt(
  game: Game,
  vignette: VignetteKey,
  day: number,
  meX: number,
  spouseX: number,
): CreditArt {
  const stage = stageFor(ageOf(game, day))
  const figures: Figure[] = [{ who: 'me', sex: game.sex, stage, x: meX }]
  if (marriedBy(game, day)) {
    figures.push({ who: 'spouse', sex: opposite(game.sex), stage, x: spouseX })
  }
  return { vignette, figures }
}

/**
 * 아이가 태어난 그림: 아기 침대(오른쪽) 옆에 부모가 서고, 먼저 태어난 아이들은 그 왼쪽에 어린이 몸으로 선다. 침대 왼쪽에 자리가 셋(24·12·0)뿐이라
 * 넘치는 사람은 그리지 않는다 (decisions.md 67번).
 */
function childArt(game: Game, birth: LogEntry): CreditArt {
  const stage = stageFor(ageOf(game, birth.day))
  const seq = num((birth.payload as Payload).seq)
  const people: Pick<Figure, 'who' | 'sex' | 'stage'>[] = [{ who: 'me', sex: game.sex, stage }]
  if (marriedBy(game, birth.day)) {
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

/** 시간순 줄 하나. art가 있으면 거기서 새 장이 시작된다. */
interface Moment {
  line: CreditLine
  art?: CreditArt
  key?: string
}

function childLabel(seq: number, sex: unknown): string {
  const name = ORDINALS[seq - 1] ?? `${seq}번째`
  return `${name} ${childWord(sex)}`
}

/** 기록 하나 → 크레딧 줄. 크레딧에 안 나오는 기록(뉴스·시세·성장 등)은 null. */
function momentFor(game: Game, e: LogEntry, jobsSeen: number): Moment | null {
  const p = e.payload as Payload
  const age = ageOf(game, e.day)
  switch (e.kind) {
    case 'BIRTH':
      return {
        key: 'born',
        line: {
          text: `${age}세, 태어났다`,
          sub: `${STAT_KEYS.map(
            (k) => `${STAT_LABELS[k]} ${gradeOf(game.initialStats[k])} ${game.initialStats[k]}`,
          ).join(' · ')} · 통장 ${won(game.initialAsset)}`,
        },
        art: { vignette: 'nursery', figures: [{ who: 'me', sex: game.sex, stage: 'baby', x: 22 }] },
      }
    case 'TRAIT':
      return { line: { text: `${age}세 · ${str(p.eventTitle)}`, sub: str(p.optionLabel) } }
    case 'STYLE': {
      const type = game.investorType
      return {
        line: {
          text: `${age}세, 투자 성향이 정해졌다`,
          sub: type ? `${type.name} — ${type.description}` : str(p.investorTypeName),
          tone: 'accent',
        },
      }
    }
    case 'JOB': {
      const line: CreditLine = p.fullTimeInvestor
        ? { text: `${age}세, 전업투자자가 됐다`, sub: '월급 없음' }
        : {
            text: `${age}세, ${str(p.jobTitle)}${p.rehire ? '(으)로 다시 취직' : '에 취직'}`,
            sub: `월급 ${won(num(p.monthlySalary))}`,
          }
      if (jobsSeen > 0) {
        return { line }
      }
      // 첫 일터만 그림이 붙는다.
      const art: CreditArt = p.fullTimeInvestor
        ? { vignette: 'studio', figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 36 }] }
        : { vignette: 'office', figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 38 }] }
      return { key: 'work', line, art }
    }
    case 'JOB_WAIT':
      return { line: { text: `${age}세, 더 나은 자리를 기다렸다`, tone: 'muted' } }
    case 'CAREER':
      return {
        line: {
          text: `${age}세 · ${str(p.eventTitle)}`,
          sub: `${str(p.optionLabel)} → ${str(p.text)}`,
          tone: p.success === false ? 'down' : undefined,
        },
      }
    case 'RETIRE':
      return { line: { text: `${age}세, 은퇴`, sub: `퇴직금 ${won(num(p.severance))}` } }
    case 'MARRIAGE':
      return {
        key: 'family',
        // 소개가 있는 배우자면 누구와 결혼했는지, 어떤 사람이었는지 (decisions.md 77번).
        line: {
          text: `${age}세, ${p.name ? `${withParticle(str(p.name), '과', '와')} ` : ''}결혼`,
          sub: p.intro ? str(p.intro) : undefined,
        },
        art: coupleArt(game, 'family', e.day, 14, 28),
      }
    case 'CHILD': {
      const seq = num(p.seq)
      return {
        key: `child-${seq}`,
        line: { text: `${age}세, ${withParticle(childLabel(seq, p.sex), '이', '가')} 태어났다` },
        art: childArt(game, e),
      }
    }
    case 'CHILD_LEFT': {
      const name = ORDINALS[num(p.seq) - 1] ?? `${num(p.seq)}번째`
      return {
        line: {
          text: `${age}세, ${name}가 독립했다`,
          sub: `${num(p.childAge)}살에 집을 나갔다`,
          tone: 'muted',
        },
      }
    }
    case 'CHILD_WEDDING': {
      const name = ORDINALS[num(p.seq) - 1] ?? `${num(p.seq)}번째`
      const cost = num(p.cost)
      return {
        line: {
          text: `${age}세, ${name}가 결혼했다`,
          sub:
            cost <= 0
              ? '결혼 비용은 아이가 알아서 마련했다'
              : cost >= num(p.total)
                ? `결혼 비용 ${won(cost)}을 모두 대줬다`
                : `결혼 비용 ${won(num(p.total))} 가운데 ${won(cost)}을 보탰다`,
          tone: cost > 0 ? 'down' : undefined,
        },
      }
    }
    case 'HOME_SOLD':
      return {
        line: {
          text: `${age}세, ${str(p.regionName)} 매도`,
          sub: `${won(num(p.price))} (산 값 ${won(num(p.purchasePrice))})`,
          tone: num(p.price) >= num(p.purchasePrice) ? 'up' : 'down',
        },
      }
    case 'HOUSING': {
      // 넘긴 공고·떨어진 청약은 살아온 집이 아니다.
      if (p.option === 'PASS' || (p.option === 'APPLY' && p.bought !== true)) {
        return null
      }
      if (p.fraud) {
        return {
          line: {
            text: `${age}세, 전세사기`,
            sub: `보증금 ${won(num(p.lost))}을 잃었다`,
            tone: 'down',
          },
        }
      }
      const line: CreditLine =
        p.option === 'APPLY'
          ? {
              text: `${age}세, 청약 당첨 · ${str(p.regionName)}`,
              sub: `분양가 ${won(num(p.price))}`,
              tone: 'up',
            }
          : num(p.price) > 0
            ? { text: `${age}세, ${str(p.regionName)} 매수`, sub: won(num(p.price)) }
            : { text: `${age}세, ${str(p.label)}`, sub: `보증금 ${won(num(p.deposit))}` }
      const vignette = HOME_VIGNETTE[str(p.option)]
      if (!vignette) {
        return { line }
      }
      return { key: `home-${e.seq}`, line, art: coupleArt(game, vignette, e.day, 0, 11) }
    }
    case 'CRISIS':
      return {
        line: {
          text: `${num(p.startAge)}~${num(p.endAge)}세, ${str(p.name)} (${p.severity === 'DEPRESSION' ? '대공황' : '불황'})`,
          sub: `주가 평균 ${percent(num(p.dropBp))} 하락 · ${withParticle(str(p.model), '을', '를')} 닮았다`,
          tone: 'down',
        },
      }
    case 'LEVERAGE':
      return {
        line: p.borrowed
          ? { text: `${age}세, ${str(p.stockName)}에 빚투`, sub: `대출 ${won(num(p.loan))}` }
          : { text: `${age}세, ${str(p.stockName)} 급락에도 빚은 지지 않았다`, tone: 'muted' },
      }
    default:
      return null
  }
}

/**
 * 엔딩 크레딧 (엔딩 설계 3절, decisions.md 70번). 제목 다음은 **기록을 시간순으로** 한 줄씩 늘어놓는다. 미리 정한 장(일·가족·집…)은 없고,
 * 그림이 붙는 순간(태어남·첫 일터·결혼·아이·이사)마다 그 해(年)를 제목으로 새 장이 시작된다. 가장 잘한·아쉬운 선택도 그 나이 자리에 끼어든다.
 * 끝에 "돌아보며"(뉴스 앞에서, 산 주식들)와 "마지막"(자산·엔딩 문장)만 남는다.
 */
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

  const scored = scoreDecisions(game)
  const best = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score > 0 && (!acc || d.score > acc.score) ? d : acc),
    null,
  )
  const worst = scored.reduce<ScoredDecision | null>(
    (acc, d) => (d.score < 0 && (!acc || d.score < acc.score) ? d : acc),
    null,
  )

  // 시간순 한 줄기. 그림이 붙는 순간마다 새 장.
  let current: CreditSection | null = null
  let jobsSeen = 0
  const push = (line: CreditLine, day: number, key?: string, art?: CreditArt) => {
    if (art || !current) {
      current = {
        key: key ?? `life-${day}`,
        title: `${yearOf(ageOf(game, day))}년`,
        lines: [],
        art,
      }
      sections.push(current)
    }
    current.lines.push(line)
  }
  for (const e of game.log) {
    if (best && e.seq === best.seq) {
      push({ ...decisionLine(best), text: `가장 잘한 선택 · ${decisionLine(best).text}` }, e.day)
    }
    if (worst && e.seq === worst.seq) {
      push(
        { ...decisionLine(worst), text: `가장 아쉬운 선택 · ${decisionLine(worst).text}` },
        e.day,
      )
    }
    const moment = momentFor(game, e, jobsSeen)
    if (e.kind === 'JOB') {
      jobsSeen++
    }
    if (moment) {
      push(moment.line, e.day, moment.key, moment.art)
    }
  }

  // 돌아보며: 뉴스 앞에서 어땠는가, 어떤 주식을 샀는가.
  const news = entries(game, 'NEWS')
  const shakes = entries(game, 'SHAKE')
  const reviewLines: CreditLine[] = []
  if (news.length === 0 && shakes.length === 0) {
    reviewLines.push({ text: '투자를 시작하지 않았다', tone: 'muted' })
  } else {
    if (news.length > 0) {
      const counts = { BUY: 0, SELL: 0, HOLD: 0 }
      for (const e of news) {
        const actual = str((e.payload as Payload).actual) as keyof typeof counts
        if (actual in counts) {
          counts[actual]++
        }
      }
      reviewLines.push({
        text: `뉴스 ${news.length}번 앞에 섰다`,
        sub: `매수 ${counts.BUY} · 매도 ${counts.SELL} · 관망 ${counts.HOLD}`,
      })
    }
    if (shakes.length > 0) {
      const held = shakes.filter((e) => str((e.payload as Payload).actual) === 'HOLD').length
      reviewLines.push({
        text: `보유 종목이 ${shakes.length}번 흔들렸다`,
        sub: `버팀 ${held} · 팔았음 ${shakes.length - held}`,
      })
    }
    const deviations = Object.entries(result?.deviationCounts ?? {}).sort(([, a], [, b]) => b - a)
    for (const [code, count] of deviations) {
      reviewLines.push({ text: `${statLabel(code)} 부족으로 뒤집힌 선택 ${count}번`, tone: 'down' })
    }
    if (deviations.length === 0) {
      reviewLines.push({ text: '한 번도 뒤집히지 않았다', tone: 'accent' })
    }
    for (const s of stockReturns(game)) {
      reviewLines.push({
        text: s.stockName,
        sub: `${signedWon(s.pnl)} (${signedPercent(s.pnlBp)}) · 투입 ${won(s.invested)}`,
        tone: s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : 'muted',
      })
    }
  }
  sections.push({ key: 'review', title: '돌아보며', lines: reviewLines })

  const finalAsset = result?.finalAsset ?? game.totalAsset
  const returnBp = result?.returnBp ?? 0
  const lastLines: CreditLine[] = [
    { text: `${won(game.initialAsset)} → ${won(finalAsset)}` },
    { text: signedPercent(returnBp), tone: returnBp >= 0 ? 'up' : 'down' },
    // 돈만이 아니라 삶이 어땠는지 (decisions.md 82번).
    {
      text: `행복도 ${game.happiness}점`,
      tone: game.happiness >= 60 ? 'accent' : game.happiness < 40 ? 'down' : 'muted',
    },
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
  // 마지막 그림: 창가의 노년(배우자와 함께). 파산이면 비 오는 거리에 혼자.
  const lastArt: CreditArt = bankrupt
    ? { vignette: 'rain', figures: [{ who: 'me', sex: game.sex, stage: 'old', x: 20 }] }
    : {
        vignette: 'home-old',
        figures: [
          { who: 'me', sex: game.sex, stage: 'old', x: 28 },
          ...(game.household.married
            ? [{ who: 'spouse', sex: opposite(game.sex), stage: 'old', x: 12 } as const]
            : []),
        ],
      }
  sections.push({ key: 'last', title: '마지막', lines: lastLines, art: lastArt })

  return sections
}
