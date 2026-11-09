import type { Company } from '../../api/client'
import { returnText } from './investShow'

type Invest = NonNullable<Company['invest']>
type Outcome = NonNullable<Invest['outcome']>

/**
 * 결과 화면의 회의 수익률 (decisions.md 388·418번): 실제 나온 수익률 하나만 크게 보인다. 오갈 수 있는 범위·띠·맞힌 쪽/틀린 쪽 수익률은 보이지
 * 않는다(418번). 판돈을 적기 전에 정한 옛 회의(returnBp 없음)면 그리지 않는다.
 */
export function ReturnResult({ outcome, delay }: { outcome: Outcome; delay: number }) {
  if (outcome.returnBp == null) {
    return null
  }
  const value = outcome.returnBp
  const tone = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink'
  return (
    <section
      className={`animate-reveal mt-3 rounded border-2 bg-card px-3 py-2 text-center ${
        value > 0 ? 'border-up/50' : value < 0 ? 'border-down/50' : 'border-line'
      }`}
      style={{ animationDelay: `${delay}ms` }}
      aria-label="회의 수익률"
      data-testid="invest-return"
    >
      <p className="text-[13px] text-muted">회의 수익률</p>
      <p
        className={`animate-flash font-bold font-mono-num text-[44px] leading-none ${tone}`}
        style={{ animationDelay: `${delay}ms` }}
        data-testid="invest-return-value"
      >
        {returnText(value)}
      </p>
    </section>
  )
}
