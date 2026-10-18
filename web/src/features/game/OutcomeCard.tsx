import type { Outcome } from '../../api/client'
import {
  actionLabel,
  deviationMessage,
  percent,
  signedWon,
  statLabel,
  TRADE_NOTES,
  won,
} from './labels'
import { Overlay } from './Overlay'

/** 선택 → 실제 행동과 그 원인을 보여 준다. 원인이 보여야 억울함이 동기가 된다 (prd.md F6). */
export function OutcomeCard(props: { outcome: Outcome; onContinue: () => void }) {
  const card = <Body {...props} />
  return props.outcome.kind === 'NEWS' ? <Overlay>{card}</Overlay> : card
}

function Body({ outcome, onContinue }: { outcome: Outcome; onContinue: () => void }) {
  const deviated = outcome.chosen !== outcome.actual
  const price = outcome.price

  return (
    <section
      className="rounded-md border border-line bg-card px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      data-testid="outcome-card"
    >
      {outcome.kind === 'NEWS' ? (
        <>
          <p className="text-[11px] font-bold text-wine">결과</p>
          <p className="mt-2 font-serif-kr text-xl font-black" data-testid="outcome-actions">
            선택 {actionLabel(outcome.chosen)} <span className="text-faint">→</span> 실제{' '}
            <span className={deviated ? 'text-wine' : ''}>{actionLabel(outcome.actual)}</span>
          </p>
          {outcome.deviations.map((d) => (
            <p
              key={`${d.statCode}-${d.from}-${d.to}`}
              className="mt-2 border-l-[3px] border-wine bg-wine-soft px-2.5 py-1.5 text-[13px] text-wine"
            >
              {deviationMessage(d.statCode, d.from, d.to)}
            </p>
          ))}
          {outcome.trade && TRADE_NOTES[outcome.trade.status] && (
            <p className="mt-2 text-[13px] text-muted">{TRADE_NOTES[outcome.trade.status]}</p>
          )}
          {outcome.trade?.status === 'EXECUTED' && (
            <p className="mt-2 text-[13px] text-muted">
              {actionLabel(outcome.actual)} 금액{' '}
              <span className="font-mono-num">{won(outcome.trade.amount)}</span>
            </p>
          )}
          {price && (
            <p className="mt-3 text-[13px]">
              {price.sectorName} 주가{' '}
              <b className={`font-mono-num ${price.direction === 'UP' ? 'text-up' : 'text-down'}`}>
                {price.direction === 'UP' ? '▲' : '▼'} {percent(price.changeBp)}
              </b>
              {price.pnl !== 0 && (
                <>
                  {' · 손익 '}
                  <b
                    className={`animate-flash font-mono-num ${price.pnl > 0 ? 'text-up' : 'text-down'}`}
                  >
                    {signedWon(price.pnl)}
                  </b>
                </>
              )}
            </p>
          )}
          {price?.lossSoftened && (
            <p className="mt-1 text-xs text-teal">🍀 운 좋게 손실이 줄었다</p>
          )}
          {outcome.growth.map((g) => (
            <p key={g.statCode} className="mt-1 text-xs text-teal">
              ↑ 경험으로 {statLabel(g.statCode)} {g.before} → {g.after}
            </p>
          ))}
        </>
      ) : (
        <p className="whitespace-pre-line text-[15px]" data-testid="outcome-message">
          {outcome.message}
        </p>
      )}
      <button
        type="button"
        className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        onClick={onContinue}
      >
        계속
      </button>
    </section>
  )
}
