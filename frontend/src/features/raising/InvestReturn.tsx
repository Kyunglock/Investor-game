import type { Company } from '../../api/client'
import { bandAt, returnText } from './investShow'

type Invest = NonNullable<Company['invest']>
type Range = Invest['range']
type Outcome = NonNullable<Invest['outcome']>

/**
 * 종목 회의 수익률의 띠 (decisions.md 388번): 왼쪽 끝 −50%, 오른쪽 끝 +300%. 잃는 쪽은 파랑, 버는 쪽은 빨강(한국 증시 색), 0에 눈금. mark가 있으면
 * 실제 나온 수익률 자리에 점을 찍는다.
 */
function ReturnBand({ range, mark }: { range: Range; mark?: number }) {
  const zero = bandAt(0, range)
  return (
    <div className="mt-2" aria-hidden="true">
      <div className="relative h-3 rounded-full bg-line-soft">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-down/25"
          style={{ width: `${zero}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-up/25"
          style={{ left: `${zero}%` }}
        />
        <div className="absolute -inset-y-1 w-0.5 bg-ink/60" style={{ left: `${zero}%` }} />
        {mark !== undefined && (
          <div
            className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
              mark >= 0 ? 'bg-up' : 'bg-down'
            }`}
            style={{ left: `${bandAt(mark, range)}%` }}
            data-testid="invest-return-mark"
          />
        )}
      </div>
      <div className="relative mt-1 h-4 font-mono-num text-[11px] text-muted">
        <span className="absolute left-0">{returnText(range.lossBp)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${zero}%` }}>
          0
        </span>
        <span className="absolute right-0">{returnText(range.gainBp)}</span>
      </div>
    </div>
  )
}

/**
 * 투자 결정 화면의 수익률 범위 (decisions.md 388번): 이번 회의가 얼마나 오르내릴 수 있는지(−50% ~ +300%)를 크게 보인다. 종목마다의 실제 폭은
 * 결과에서 드러난다.
 */
export function ReturnRange({ range }: { range: Range }) {
  return (
    <section
      className="mt-2 rounded border border-line bg-card px-3 py-2"
      aria-label="이번 회의 수익률 범위"
      data-testid="invest-range"
    >
      <p className="text-[12px] text-muted">이번 회의 수익률</p>
      <p className="font-bold font-mono-num text-[28px] leading-tight">
        <span className="text-down">{returnText(range.lossBp)}</span>
        <span className="mx-1.5 text-muted">~</span>
        <span className="text-up">{returnText(range.gainBp)}</span>
      </p>
      <ReturnBand range={range} />
      <p className="mt-1 text-[12px] text-muted">
        맞히면 크게 움직이는 종목일수록 많이 법니다(최대 {returnText(range.gainBp)}). 틀리면 최대{' '}
        {returnText(range.lossBp)}까지 잃습니다.
      </p>
    </section>
  )
}

/**
 * 결과 화면의 회의 수익률 (decisions.md 388번): 실제 나온 수익률을 크게, 띠 위에 점으로, 그리고 맞힌 쪽·틀린 쪽이었으면 얼마였는지. 판돈을 적기 전에
 * 정한 옛 회의(returnBp 없음)면 그리지 않는다.
 */
export function ReturnResult({
  range,
  outcome,
  delay,
}: {
  range: Range
  outcome: Outcome
  delay: number
}) {
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
      <p className="text-[13px] text-muted">
        회의 수익률{' '}
        <span className="text-[11px]">
          (범위 {returnText(range.lossBp)} ~ {returnText(range.gainBp)})
        </span>
      </p>
      <p
        className={`animate-flash font-bold font-mono-num text-[44px] leading-none ${tone}`}
        style={{ animationDelay: `${delay}ms` }}
        data-testid="invest-return-value"
      >
        {returnText(value)}
      </p>
      <ReturnBand range={range} mark={value} />
      <p className="text-[12px] text-muted" data-testid="invest-return-sides">
        맞힌 쪽이면 <b className="text-up">{returnText(outcome.gainBp)}</b> · 틀린 쪽이면{' '}
        <b className="text-down">{returnText(outcome.lossBp)}</b>
      </p>
    </section>
  )
}
