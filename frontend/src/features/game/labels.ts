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

/** 게임 금액 단위 (decisions.md 313번): 1,000마다 a·b·c·d… 로 올라간다. 등급 글자(F~S)와 헷갈리지 않게 소문자다. */
export const MONEY_UNITS = 'abcdefghijklmnopqrstuvwxyz'

/**
 * 게임 금액: 1,000 아래는 그대로, 그 위는 1a(1천)·1b(100만)·1c(10억)·1d(1조)·1e(1천조)… 앞자리는 세 자리까지(10 아래는 소수 둘째, 100 아래는 첫째 자리).
 * 원화(억·조)를 쓰지 않는다. 예: 950 · 3.5a · 412.5b → 413b · 1.2c · −45.3b.
 */
export function money(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  let abs = Math.abs(Math.round(amount))
  if (abs < 1000) {
    return `${sign}${abs}`
  }
  let unit = 0
  while (abs >= 1000 && unit < MONEY_UNITS.length) {
    abs /= 1000
    unit++
  }
  const digits = abs < 10 ? 2 : abs < 100 ? 1 : 0
  let text = abs.toFixed(digits)
  // 999.96b가 반올림으로 1000b가 되면 1c로 올린다.
  if (Number(text) >= 1000 && unit < MONEY_UNITS.length) {
    unit++
    text = (Number(text) / 1000).toFixed(2)
  }
  text = text.includes('.') ? text.replace(/\.?0+$/, '') : text
  return `${sign}${text}${MONEY_UNITS[unit - 1]}`
}

/** 부호를 붙인 게임 금액: +3.5a, −45.3b, 0. */
export function signedMoney(amount: number): string {
  return `${amount > 0 ? '+' : ''}${money(amount)}`
}

/** 마지막 글자에 받침이 있는가. 한글이 아니면(숫자·영문) 받침이 없다고 본다. */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

/** 낱말에 받침에 맞는 조사를 붙인다: withParticle('한탕증권', '을', '를') → '한탕증권을'. */
export function withParticle(word: string, withFinal: string, withoutFinal: string): string {
  return word + (hasBatchim(word) ? withFinal : withoutFinal)
}
