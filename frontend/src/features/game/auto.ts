import type { Game, PendingEvent } from '../../api/client'
import { quantityForCash, quantityForHolding } from './market'

/**
 * 자동 선택 (decisions.md 131번). 켜 두면 선택 카드를 성향(기간·위험·소신)과 능력치(안목·인내·용기·줏대)로 대신 고르고, 결과 카드와 위기 회고도
 * 저절로 넘겨 엔딩 크레딧까지 흐른다. 화면이 보는 것(대기 이벤트·힌트·시세·보유·현금)만 보고 고르며 숨은 값은 쓰지 않는다. 같은 이벤트면 같은 선택을
 * 한다(이벤트 ID가 난수 시드).
 */
export interface AutoChoice {
  option: string
  /** 뉴스 매수·매도, 빚투의 수량. 다른 선택에는 없다 */
  quantity?: number
}

/** 선택 카드가 뜬 뒤 고르기까지. 무엇이 떴는지 눈으로 볼 틈이다. */
export const AUTO_CHOOSE_DELAY_MS = 1_500
/** 결과가 드러난 뒤 넘어가기까지. */
export const AUTO_CONTINUE_DELAY_MS = 1_800
/** 위기 회고를 읽을 시간. */
export const AUTO_CRISIS_DELAY_MS = 2_500

export type Direction = 'UP' | 'DOWN' | 'NEUTRAL'

/**
 * 힌트 문구가 가리키는 방향 (phrases.json hints). 부정형("위쪽은 아니다", "나쁜 소식은 아닌")이 낱말보다 먼저다. 모르는 문구면 null.
 * 안목이 높을수록 힌트가 또렷하므로 자동 선택도 안목을 따라 좋아진다.
 */
const RULES: ReadonlyArray<readonly [RegExp, Direction]> = [
  [/위쪽은 아니|위를 보긴 어렵|좋은 소식은 아닌|좋은 소식은 아니/, 'DOWN'],
  [/나쁜 소식은 아닌|나쁘진 않/, 'UP'],
  [/모르겠|글쎄|단정하지|뉴스가 뉴스지|시장 반응을 봐야/, 'NEUTRAL'],
  [
    /위험|불안|악재|찜찜|밀릴|역풍|빠진다|빠져나가|흔들릴|조정|하락|부담|피하는|깨진다|줄이자|마진에/,
    'DOWN',
  ],
  [
    /유리|올라|올랐|오를|호재|상승|들썩|위쪽|플러스|재평가|위로|수급이 몰릴|추세는 위|실적 기대/,
    'UP',
  ],
]

export function hintDirection(hint: string | null | undefined): Direction | null {
  if (!hint) {
    return null
  }
  for (const [pattern, direction] of RULES) {
    if (pattern.test(hint)) {
      return direction
    }
  }
  return null
}

/** 0 이상 1 미만. 같은 문자열 시드면 같은 수열 (FNV-1a로 씨를 만들고 mulberry32로 돌린다). */
export function seededRandom(seed: string): () => number {
  let a = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    a = Math.imul(a ^ seed.charCodeAt(i), 0x01000193) >>> 0
  }
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Option = PendingEvent['options'][number]

/** 용기가 높은 사람이 고르는 직장 선택지. 장면에 없는 코드는 그냥 지나간다. */
const BOLD_CAREER = new Set([
  'move',
  'apply',
  'accept',
  'take',
  'go',
  'push',
  'join',
  'try',
  'volunteer',
  'counter',
  'open',
  'invest',
  'found',
  'bid',
  'hire',
  'grow',
  'overseas',
  'negotiate',
])
/** 용기가 낮은 사람이 고르는 직장 선택지. */
const SAFE_CAREER = new Set([
  'stay',
  'pass',
  'decline',
  'endure',
  'hold',
  'keep',
  'wait',
  'quiet',
  'skip',
  'refuse',
  'ignore',
  'rest',
  'comply',
  'safe',
  'calm',
])

/** 주거 선택지의 우선순위. 서버가 돈이 모자라면 막아 두므로(blocked) 살 수 있는 것만 남는다. 좁아도 그냥 산다(ENDURE)는 늘 마지막이다. */
const BOLD_HOUSING = [
  'BUY_SEOUL',
  'BUY_GYEONGGI',
  'APT_JEONSE',
  'VILLA_INSURED',
  'STAY',
  'KEEP',
  'VILLA',
  'MONTHLY',
  'WAIT',
  'ENDURE',
]
const SAFE_HOUSING = [
  'APT_JEONSE',
  'VILLA_INSURED',
  'STAY',
  'KEEP',
  'BUY_GYEONGGI',
  'VILLA',
  'MONTHLY',
  'WAIT',
  'BUY_SEOUL',
  'ENDURE',
]

/** 성향이 아직 안 정해졌으면(성장기) 능력치로만 본다. */
function isBold(game: Game): boolean {
  const risk = game.riskProfile?.code
  return risk ? risk === 'bold' : game.stats.courage >= 55
}

function isLongTerm(game: Game): boolean {
  const style = game.investmentStyle?.code
  return style ? style === 'long' : game.stats.patience >= 55
}

function followsCrowd(game: Game): boolean {
  const mind = game.mindProfile?.code
  return mind ? mind === 'crowd' : game.stats.conviction < 45
}

/** 뉴스 매수에 쓰는 현금 비율. 위험 성향이 바탕이고 용기가 조금 더한다. */
export function buyPercent(game: Game): number {
  const base = isBold(game) ? 50 : 20
  const courage = game.stats.courage >= 70 ? 10 : game.stats.courage < 40 ? -10 : 0
  return Math.max(10, Math.min(100, base + courage))
}

/** 대기 중인 선택에 낼 답. 대기 중인 선택이 없거나 고를 수 있는 선택지가 없으면 null. */
export function autoChoice(game: Game): AutoChoice | null {
  const event = game.pendingEvent
  if (!event) {
    return null
  }
  const open = event.options.filter((o) => o.blocked == null)
  if (open.length === 0) {
    return null
  }
  const random = seededRandom(event.eventId)
  const codes = new Set(open.map((o) => o.code))
  const has = (code: string) => codes.has(code)
  const first = { option: open[0].code }

  switch (event.kind) {
    case 'NEWS':
      return newsChoice(game, event, has)
    case 'SHAKE':
      // 흔들림: 장기 성향이거나 인내심이 있으면 버틴다. 서버가 인내·용기로 다시 판정한다.
      return { option: isLongTerm(game) || game.stats.patience >= 45 ? 'HOLD' : 'SELL' }
    case 'LEVERAGE':
      return leverageChoice(game, event, has)
    case 'OFFER':
      return has('accept') ? { option: 'accept' } : first
    case 'TRAIT':
      // 성장기·일상 장면은 성격을 만드는 쪽이다. 고르게 뽑아 그 판의 성격이 된다.
      return { option: pick(open, random).code }
    case 'JOB':
      return jobChoice(game, open, random)
    case 'CAREER':
      return careerChoice(game, open, random)
    case 'LIFE':
      return lifeChoice(game, has, first)
    case 'HOUSING': {
      const order = isBold(game) ? BOLD_HOUSING : SAFE_HOUSING
      const preferred = order.find((code) => has(code))
      if (preferred) {
        return { option: preferred }
      }
      // 청약: 넣어 본다. 다시 안 묻기(NEVER)는 고르지 않는다.
      if (has('APPLY')) {
        return { option: 'APPLY' }
      }
      return { option: open.find((o) => o.code !== 'NEVER')?.code ?? open[0].code }
    }
    default:
      return first
  }
}

function newsChoice(game: Game, event: PendingEvent, has: (code: string) => boolean): AutoChoice {
  const price = game.market.stocks.find((s) => s.code === event.stockCode)?.price ?? 0
  const holding = game.holdings.find((h) => h.stockCode === event.stockCode)
  const held = (holding?.quantity ?? 0) > 0
  let direction = hintDirection(event.hint)
  if (direction == null || direction === 'NEUTRAL') {
    // 방향을 모르면 추종 성향은 최근 흐름을 따르고, 소신 성향은 관망한다.
    const spark = event.spark ?? []
    const rising = spark.length >= 2 && spark[spark.length - 1] > spark[0]
    const falling = spark.length >= 2 && spark[spark.length - 1] < spark[0]
    direction = followsCrowd(game) ? (rising ? 'UP' : falling ? 'DOWN' : 'NEUTRAL') : 'NEUTRAL'
  }
  if (direction === 'UP' && has('BUY')) {
    const quantity = quantityForCash(game.cash, price, buyPercent(game))
    if (quantity >= 1) {
      return { option: 'BUY', quantity }
    }
  }
  if (direction === 'DOWN' && held && has('SELL') && holding) {
    // 인내심이 있으면 절반만 줄이고, 없으면 다 판다.
    const quantity = quantityForHolding(holding.quantity, game.stats.patience >= 60 ? 50 : 100)
    if (quantity >= 1) {
      return { option: 'SELL', quantity }
    }
  }
  return { option: has('HOLD') ? 'HOLD' : event.options[0].code }
}

/** 빚투 상한: 순자산의 이 비율까지. DecisionCard·서버(progress.leverage-loan-bp)와 같은 값 (decisions.md 39번). */
const LEVERAGE_LOAN_PERCENT = 50
/** 자동 선택이 빌리는 몫: 상한의 이 비율. */
const LEVERAGE_USE_PERCENT = 30

function leverageChoice(
  game: Game,
  event: PendingEvent,
  has: (code: string) => boolean,
): AutoChoice {
  // 빚투는 공격 성향에 용기까지 있고 빚이 없을 때만. 힌트가 내릴 쪽이면 하지 않는다.
  const daring = isBold(game) && game.stats.courage >= 60 && game.debt <= 0
  if (daring && has('BORROW') && hintDirection(event.hint) !== 'DOWN') {
    const price = game.market.stocks.find((s) => s.code === event.stockCode)?.price ?? 0
    const maxLoan = Math.floor((Math.max(0, game.totalAsset) * LEVERAGE_LOAN_PERCENT) / 100)
    const quantity = quantityForCash(maxLoan, price, LEVERAGE_USE_PERCENT)
    if (quantity >= 1) {
      return { option: 'BORROW', quantity }
    }
  }
  return { option: has('PASS') ? 'PASS' : event.options[0].code }
}

/** 직업 선택지 문구 "사무직 · 월 280만 원"의 월급(만 원). 없으면 0. */
export function salaryOf(label: string): number {
  const m = /월 ([\d,]+)만/.exec(label)
  return m ? Number(m[1].replace(/,/g, '')) : 0
}

function jobChoice(game: Game, open: Option[], random: () => number): AutoChoice {
  // 전업투자자(INVEST)는 월급이 없어 자동 진행에 위험하고, 기다리기(WAIT)는 판만 늦춘다.
  const jobs = open.filter((o) => o.code !== 'INVEST' && o.code !== 'WAIT')
  if (jobs.length === 0) {
    return { option: open[0].code }
  }
  // 안목이 있으면 월급이 가장 높은 자리를 알아본다. 없으면 눈에 띄는 대로.
  if (game.stats.insight >= 60) {
    const best = [...jobs].sort((a, b) => salaryOf(b.label) - salaryOf(a.label))[0]
    return { option: best.code }
  }
  return { option: pick(jobs, random).code }
}

function careerChoice(game: Game, open: Option[], random: () => number): AutoChoice {
  const wanted =
    game.stats.courage >= 60 ? BOLD_CAREER : game.stats.courage < 40 ? SAFE_CAREER : null
  if (wanted) {
    const matched = open.filter((o) => wanted.has(o.code))
    if (matched.length > 0) {
      return { option: pick(matched, random).code }
    }
  }
  return { option: pick(open, random).code }
}

/** 여행·나들이에 보통으로 가려면 이만큼의 현금은 있어야 한다. */
const COMFORTABLE_CASH = 3_000_000

function lifeChoice(game: Game, has: (code: string) => boolean, first: AutoChoice): AutoChoice {
  // 결혼·자녀: 둘째까지 받아들인다.
  if (has('accept')) {
    return { option: game.household.children.length < 2 ? 'accept' : 'decline' }
  }
  // 자녀 결혼 비용: 절반만 보탠다.
  if (has('half')) {
    return { option: 'half' }
  }
  // 여행·나들이: 현금이 넉넉하면 보통, 아니면 싸게. 안 가지는 않는다(행복도·가족 점수가 깎인다).
  if (has('normal')) {
    return { option: game.cash >= COMFORTABLE_CASH || !has('cheap') ? 'normal' : 'cheap' }
  }
  return first
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}
