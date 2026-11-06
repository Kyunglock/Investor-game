import type { Company } from '../../api/client'
import type { Matchup } from '../game/tug'
import { STAT_NAMES, shareOf } from './grades'

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
export function investTimeline(traders: number, tugMs: number, skipped: boolean): InvestTimeline {
  if (skipped) {
    return { tugAt: () => 0, pnlAt: () => 0, reveal: 0, total: 0, end: 0 }
  }
  const gap = traders <= 2 ? tugMs + BETWEEN_MS : OVERLAP_MS
  const tugAt = (i: number) => STAMP_MS + i * gap
  const tugsEnd = traders === 0 ? STAMP_MS : tugAt(traders - 1) + tugMs
  const reveal = tugsEnd + REVEAL_PAUSE_MS
  const pnlAt = (i: number) => reveal + PNL_PAUSE_MS + i * PNL_STEP_MS
  const total = pnlAt(Math.max(0, traders - 1)) + TOTAL_PAUSE_MS
  return { tugAt, pnlAt, reveal, total, end: total + END_PAUSE_MS }
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
): Matchup | null {
  if (!r.rival) {
    return null
  }
  const stat = r.rival.stat
  const grade = employees.find((e) => e.id === r.employeeId)?.grades[stat]
  return {
    stat,
    mine: { action: label(choice), trait: `사장 말 · ${STAT_NAMES[stat] ?? stat}` },
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
  UP: { label: '사자', tone: 'border-up text-up' },
  DOWN: { label: '팔자', tone: 'border-down text-down' },
  NEUTRAL: { label: '모르겠다', tone: 'border-line text-muted' },
}

/**
 * 투자 회의 한마디를 같은 의견(사자·팔자·모르겠다)끼리 모은다 (242번). 사람이 많은 쪽이 먼저, 같으면 사자 → 팔자 → 모르겠다. 아무도 없는 의견은 뺀다.
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
