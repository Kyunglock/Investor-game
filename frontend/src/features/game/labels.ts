import type { Phase, Stats } from '../../api/client'

/** 화면 표시용 이름과 문구. 규칙은 서버에 있고 여기에는 표시만 있다. */

export const STAT_LABELS: Record<keyof Stats, string> = {
  insight: '안목',
  patience: '인내심',
  courage: '용기',
  conviction: '줏대',
  luck: '운',
}

export const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[]

export const PHASE_LABELS: Record<Phase, string> = {
  CHILDHOOD: '성장기',
  SAVING: '저축 중',
  INVESTING: '투자 중',
  ENDED: '종료',
}

const ACTION_LABELS: Record<string, string> = { BUY: '매수', SELL: '매도', HOLD: '관망' }

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code
}

/** 흔들림(SHAKE)의 관망·매도는 "버틴다·판다"로 읽힌다. 그 밖의 종류는 매수·매도·관망 (decisions.md 33번). */
const SHAKE_ACTION_LABELS: Record<string, string> = { HOLD: '버틴다', SELL: '판다' }

export function actionLabelFor(kind: string, code: string): string {
  return kind === 'SHAKE' ? (SHAKE_ACTION_LABELS[code] ?? actionLabel(code)) : actionLabel(code)
}

export function sideLabel(side: string): string {
  return side === 'SELL' ? '매도' : '매수'
}

export function statLabel(code: string): string {
  return STAT_LABELS[code as keyof Stats] ?? code
}

/** 줏대 이탈의 꼬드김 출처(서버 behavior.md 4.2절의 source 코드)별 문구. */
const TEMPTERS: Record<string, string> = {
  youtuber: "구독자 많은 주식 유튜버가 '지금이 기회'라며 떠드는 걸 보고",
  friend: "친구가 '내부 정보'라며 귀띔해 준 말에",
  community: '주식 커뮤니티에 올라온 글에 홀려',
  broadcast: '증권 방송 전문가의 말을 믿고',
  relative: "친척 어른이 '이건 된다'며 권하는 바람에",
}

/** 이탈 원인이 보여야 억울함이 동기가 된다 (prd.md 2절). source는 줏대 이탈일 때 꼬드김 출처. */
export function deviationMessage(
  statCode: string,
  from: string,
  to: string,
  source?: string | null,
): string {
  switch (statCode) {
    case 'conviction': {
      const tempter = (source && TEMPTERS[source]) || '다른 뉴스에 휘둘려'
      const did =
        to === 'HOLD'
          ? `${actionLabel(from)}하려던 걸 접었다`
          : `${actionLabel(from)} 대신 ${actionLabel(to)}했다`
      return `줏대 부족 — ${tempter} ${did}`
    }
    case 'patience':
      return `인내심 부족 — 들고 있던 걸 지켜보려다 못 참고 ${actionLabel(to)}했다`
    case 'courage':
      return `용기 부족 — ${actionLabel(from)} 버튼을 누르려다 겁나서 관망했다`
    default:
      return `${statLabel(statCode)} 때문에 ${actionLabel(from)} → ${actionLabel(to)}`
  }
}

/** 능력치가 오른 한 줄. reason이 TRAIT이면 성장기의 선택, 아니면(또는 없으면) 이탈 경험이다. */
export function growthText(
  statCode: string,
  before: number,
  after: number,
  reason?: string | null,
): string {
  const cause = reason === 'TRAIT' || reason === 'CAREER' ? '그 선택으로' : '경험으로'
  return `${cause} ${statLabel(statCode)} ${before} → ${after} ${after < before ? '↓' : '↑'}`
}

export const TRADE_NOTES: Record<string, string | undefined> = {
  NOTHING_TO_SELL: '팔 종목이 없었다',
  INSUFFICIENT_CASH: '현금이 부족해 사지 못했다',
}

/** 화면에 보이는 연도. 탄생 연도는 장식이라 2025년으로 고정한다 (ui-redesign 설계 5.1절). */
export const BIRTH_YEAR = 2025

export function yearOf(ageYears: number): number {
  return BIRTH_YEAR + ageYears - 1
}

const numberFormat = new Intl.NumberFormat('ko-KR')

export function won(amount: number): string {
  return `${numberFormat.format(amount)}원`
}

export function signedWon(amount: number): string {
  return `${amount > 0 ? '+' : ''}${won(amount)}`
}

export function percent(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`
}
