import type { Company } from '../../api/client'
import { money } from '../game/labels'
import type { Matchup } from '../game/tug'
import { EMPLOYEE_LADDER, STAT_NAMES, shareOf } from './grades'

type Result = NonNullable<NonNullable<Company['invest']>['outcome']>['results'][number]

/** 사장 결정 도장이 찍히고 첫 막대가 움직이기 시작하기까지(ms) */
const STAMP_MS = 500
/** 막대 사이의 쉼(ms). 둘까지는 하나씩 끝까지 보고, 셋부터는 겹쳐서 빨리 돈다 */
const BETWEEN_MS = 250
const OVERLAP_MS = 900
/** 막대가 다 끝나고 종목이 드러나기까지, 드러난 뒤 손익이 뜨기까지, 손익끼리(ms) */
const REVEAL_PAUSE_MS = 200
const PNL_PAUSE_MS = 500
const PNL_STEP_MS = 200
const TOTAL_PAUSE_MS = 400
const END_PAUSE_MS = 600

export interface InvestTimeline {
  /** i번째 직원의 막대가 움직이기 시작하는 때 */
  tugAt: (i: number) => number
  /** i번째 직원의 손익이 뜨는 때 */
  pnlAt: (i: number) => number
  /** 종목이 오르내린 것이 드러나는 때 */
  reveal: number
  /** 회의 손익이 뜨는 때 */
  total: number
  /** 연출이 끝나 결산 버튼이 나오는 때 */
  end: number
}

/**
 * 투자 회의 결과의 순서 (decisions.md 235번): 사장 결정 도장 → 직원마다 맞대결 막대 → 종목 공개 → 직원마다 손익 → 회의 손익 → 결산 버튼. 빨리 보기면
 * 모두 0이다.
 */
export function investTimeline(
  traders: number,
  tugMs: number,
  skipped: boolean,
  /** 막대보다 먼저 보이는 장면의 길이(ms). "너희가 알아서 해"의 맞붙는 장면 (decisions.md 279번) */
  lead = 0,
): InvestTimeline {
  if (skipped) {
    return { tugAt: () => 0, pnlAt: () => 0, reveal: 0, total: 0, end: 0 }
  }
  const gap = traders <= 2 ? tugMs + BETWEEN_MS : OVERLAP_MS
  const start = lead + STAMP_MS
  const tugAt = (i: number) => start + i * gap
  const tugsEnd = traders === 0 ? start : tugAt(traders - 1) + tugMs
  const reveal = tugsEnd + REVEAL_PAUSE_MS
  const pnlAt = (i: number) => reveal + PNL_PAUSE_MS + i * PNL_STEP_MS
  const total = pnlAt(Math.max(0, traders - 1)) + TOTAL_PAUSE_MS
  return { tugAt, pnlAt, reveal, total, end: total + END_PAUSE_MS }
}

/**
 * 차트로 보는 결정 장면의 순서 (decisions.md 283번): (맡겼으면 맞붙는 장면) → 결정 도장 → 차트가 그려진다 → 종목 공개 → 직원마다 손익 → 회의 손익 →
 * 결산 버튼. 빨리 보기면 모두 0이다.
 */
export function chartTimeline(
  people: number,
  chartMs: number,
  skipped: boolean,
  lead = 0,
): InvestTimeline & { chartAt: number } {
  if (skipped) {
    return { chartAt: 0, tugAt: () => 0, pnlAt: () => 0, reveal: 0, total: 0, end: 0 }
  }
  const chartAt = lead + STAMP_MS
  const reveal = chartAt + chartMs + REVEAL_PAUSE_MS
  const pnlAt = (i: number) => reveal + PNL_PAUSE_MS + i * PNL_STEP_MS
  const total = pnlAt(Math.max(0, people - 1)) + TOTAL_PAUSE_MS
  return { chartAt, tugAt: () => chartAt, pnlAt, reveal, total, end: total + END_PAUSE_MS }
}

/** 회의 수익률(만분율)을 화면 글자로: +132%, −50%, 0% (decisions.md 388번). 빼기는 다른 숫자 표시처럼 '−'. */
export function returnText(bp: number): string {
  const percent = Math.round(Math.abs(bp) / 100)
  if (percent === 0) {
    return '0%'
  }
  return `${bp > 0 ? '+' : '−'}${percent}%`
}

/** 수익률 띠(−50% ~ +300%)에서 이 수익률이 놓이는 자리(왼쪽 끝 0 ~ 오른쪽 끝 100). 띠 밖이면 끝에 붙인다. */
export function bandAt(bp: number, range: { lossBp: number; gainBp: number }): number {
  const width = range.gainBp - range.lossBp
  if (width <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, ((bp - range.lossBp) / width) * 100))
}

/** 공개 문장의 몇 %("넥손게임즈가 35% 내렸다."). 못 찾으면 0. */
export function percentOf(reveal: string): number {
  const m = /(\d+)%/.exec(reveal)
  return m ? Number(m[1]) : 0
}

/** 처음 몫은 등급 띠 가운데를 20~80%로 묶는다(181번): 처음부터 한쪽이 거의 다 차 있으면 엎치락뒤치락이 안 보인다. */
const clampStart = (v: number) => Math.min(80, Math.max(20, v))

/**
 * 직원 한 명의 맞대결 (235번). 왼쪽(청록)은 사장이 고른 행동과 그것을 지킨 능력치, 오른쪽(와인)은 맞붙은 행동과 그 출처(단골 인물의 꼬드김 또는 제 판단).
 * 승패는 서버 판정 그대로: 사장 말대로 했으면 왼쪽이 이긴다. 맞붙을 것이 없었으면 null.
 */
export function matchupOf(
  r: Result,
  choice: string,
  label: (code: string) => string,
  employees: Company['employees'],
  tempter: string,
  /** 왼쪽(지킨 쪽)의 이름: 사장이 골랐으면 "사장 말", 맡겼으면 "팀 결정" (279번) */
  boss = '사장 말',
): Matchup | null {
  if (!r.rival) {
    return null
  }
  const stat = r.rival.stat
  const grade = employees.find((e) => e.id === r.employeeId)?.grades[stat]
  return {
    stat,
    mine: { action: label(choice), trait: `${boss} · ${STAT_NAMES[stat] ?? stat}` },
    rival: {
      action: label(r.rival.action),
      trait: r.rival.kind === 'SWAY' ? `${tempter}의 꼬드김` : '제 판단',
    },
    start: clampStart(shareOf(grade)),
    won: r.follow === 'BOSS',
  }
}

type Remark = NonNullable<Company['invest']>['remarks'][number]

/** 한마디가 말하는 쪽. 같은 쪽끼리 묶는다 (decisions.md 242번). */
export const OPINIONS: Record<Remark['read'], { label: string; tone: string }> = {
  UP: { label: '투자하자', tone: 'border-up text-up' },
  DOWN: { label: '매도하자', tone: 'border-down text-down' },
  NEUTRAL: { label: '모르겠다', tone: 'border-line text-muted' },
}

/**
 * 투자 회의 한마디를 같은 의견(투자하자·매도하자·모르겠다)끼리 모은다 (242·378번). 사람이 많은 쪽이 먼저, 같으면 투자하자 → 매도하자 → 모르겠다. 아무도 없는 의견은 뺀다.
 * 묶음 안의 순서는 자리 순서 그대로다.
 */
export function groupRemarks(remarks: Remark[]): { read: Remark['read']; remarks: Remark[] }[] {
  const order: Remark['read'][] = ['UP', 'DOWN', 'NEUTRAL']
  return order
    .map((read) => ({ read, remarks: remarks.filter((r) => r.read === read) }))
    .filter((g) => g.remarks.length > 0)
    .sort(
      (a, b) =>
        b.remarks.length - a.remarks.length || order.indexOf(a.read) - order.indexOf(b.read),
    )
}

/**
 * 회의 뒤 돌아보기 (decisions.md 260번). 지켜봤으면 맞는 쪽으로 했을 때 벌었을 돈, 직원 다수결이 맞았는지, 리서치 팀 형광펜이 결정적 문장에 그었는지.
 */
export function hindsightOf(invest: NonNullable<Company['invest']>): string[] {
  const outcome = invest.outcome
  if (!outcome) {
    return []
  }
  const lines: string[] = []
  const right = outcome.up ? '샀으면' : '팔았으면'
  if (outcome.missed != null && outcome.missed > 0) {
    lines.push(`지켜봤다. ${right} 벌었을 돈 +${money(outcome.missed)}.`)
  }
  const up = invest.remarks.filter((r) => r.read === 'UP').length
  const down = invest.remarks.filter((r) => r.read === 'DOWN').length
  if (up !== down) {
    const said = up > down ? 'UP' : 'DOWN'
    const ok = (said === 'UP') === outcome.up
    lines.push(
      `직원 다수결(${said === 'UP' ? '투자하자' : '매도하자'})은 ${ok ? '맞았다' : '틀렸다'}.`,
    )
  } else if (invest.remarks.length > 0) {
    lines.push('직원 의견은 반반이었다.')
  }
  const marked = invest.sentences.findIndex((s) => s.highlighted)
  if (marked >= 0) {
    lines.push(
      marked === outcome.decisive
        ? '형광펜은 결정적 문장에 그었다.'
        : '형광펜은 곁가지에 그었다. 이번엔 빗나갔다.',
    )
  }
  return lines
}

/**
 * 의견 칸에 세우는 사람 (decisions.md 293번): 사람이 많아지면 이름이 칸을 꽉 채워서 **팀장만** 이름을 보이고 나머지는 "외 N명"이다. 대표 한마디도 팀장
 * 가운데 안목이 가장 높은 사람이 한다. 그 칸에 팀장이 없으면(팀장이 다른 의견이다) 칸에서 안목이 가장 높은 사람 하나만 세운다.
 */
export function leadersOf(
  remarks: Remark[],
  employees: Company['employees'],
): { shown: Remark[]; voice: Remark; others: number } {
  const leaders = remarks.filter((r) => employees.find((e) => e.id === r.employeeId)?.leader)
  const shown = leaders.length > 0 ? leaders : [spokesperson(remarks, employees)]
  return { shown, voice: spokesperson(shown, employees), others: remarks.length - shown.length }
}

/**
 * 같은 의견 칸의 대표 (decisions.md 246번): 한마디는 칸마다 한 번만, 그 칸에서 안목이 가장 높은 직원이 한다(같으면 자리 순서가 앞인 사람). 나머지는
 * 이름만 함께 선다.
 */
export function spokesperson(remarks: Remark[], employees: Company['employees']): Remark {
  const insight = (r: Remark) => {
    const grade = employees.find((e) => e.id === r.employeeId)?.grades.insight
    return grade ? EMPLOYEE_LADDER.indexOf(grade as (typeof EMPLOYEE_LADDER)[number]) : -1
  }
  return remarks.reduce((best, r) => (insight(r) > insight(best) ? r : best))
}
