import type { Stats } from './types'

/** 화면 표시용 이름과 금액 문구. 규칙은 서버에 있고 여기에는 표시만 있다. */

export const STAT_LABELS: Record<keyof Stats, string> = {
  insight: '안목',
  patience: '인내심',
  courage: '용기',
  conviction: '줏대',
  luck: '운',
}

export const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof Stats)[]

const numberFormat = new Intl.NumberFormat('ko-KR')

export function won(amount: number): string {
  return `${numberFormat.format(amount)}원`
}

export function signedWon(amount: number): string {
  return `${amount > 0 ? '+' : ''}${won(amount)}`
}

const MAN = 10_000
const EOK = 100_000_000

/** 수첩에 손으로 적는 금액: 만원 아래는 버린다. 2억 4,858만원, 312만원, 0원. 1만원이 안 되면 원 그대로. */
export function shortWon(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  const abs = Math.abs(amount)
  if (abs < MAN) {
    return `${sign}${won(abs)}`
  }
  const eok = Math.floor(abs / EOK)
  const man = Math.floor((abs % EOK) / MAN)
  const parts = [
    eok > 0 ? `${numberFormat.format(eok)}억` : '',
    man > 0 ? `${numberFormat.format(man)}만` : '',
  ]
  return `${sign}${parts.filter(Boolean).join(' ')}원`
}
