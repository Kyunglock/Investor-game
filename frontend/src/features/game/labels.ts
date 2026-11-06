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
const JO = 1_000_000_000_000

/**
 * 큰돈을 조·억·만으로 읽는다(원은 붙이지 않는다). 1조가 넘으면 조와 억까지만(만은 버린다): 56조 3,615억, 2억 4,858만, 312만. 만원이 안 되면 빈 글이다
 * (decisions.md 253번: 회사 등급 띠가 1천조까지 가는데 억까지만 써서 "563,615억원"이 됐다).
 */
export function bigUnits(abs: number): string {
  const jo = Math.floor(abs / JO)
  const eok = Math.floor((abs % JO) / EOK)
  const man = Math.floor((abs % EOK) / MAN)
  const parts =
    jo > 0
      ? [`${numberFormat.format(jo)}조`, eok > 0 ? `${numberFormat.format(eok)}억` : '']
      : [
          eok > 0 ? `${numberFormat.format(eok)}억` : '',
          man > 0 ? `${numberFormat.format(man)}만` : '',
        ]
  return parts.filter(Boolean).join(' ')
}

/** 수첩에 손으로 적는 금액: 만원 아래는 버린다. 56조 3,615억원, 2억 4,858만원, 312만원, 0원. 1만원이 안 되면 원 그대로. */
export function shortWon(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  const abs = Math.abs(amount)
  if (abs < MAN) {
    return `${sign}${won(abs)}`
  }
  return `${sign}${bigUnits(abs)}원`
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
