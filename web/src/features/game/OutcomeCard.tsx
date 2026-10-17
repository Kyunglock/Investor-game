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

/** 선택 → 실제 행동과 그 원인을 보여 준다. 원인이 보여야 억울함이 동기가 된다 (prd.md F6). */
export function OutcomeCard({ outcome, onContinue }: { outcome: Outcome; onContinue: () => void }) {
  const deviated = outcome.chosen !== outcome.actual

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      data-testid="outcome-card"
    >
      {outcome.kind === 'NEWS' ? (
        <>
          <h2 className="text-lg font-bold">결과</h2>
          <p className="mt-3 text-lg" data-testid="outcome-actions">
            선택 <b>{actionLabel(outcome.chosen)}</b> <span className="text-slate-400">→</span> 실제{' '}
            <b className={deviated ? 'text-rose-600' : ''}>{actionLabel(outcome.actual)}</b>
            {deviated && ' ⚠'}
          </p>
          {outcome.deviations.map((d) => (
            <p
              key={`${d.statCode}-${d.from}-${d.to}`}
              className="mt-2 rounded-lg bg-rose-50 px-4 py-2 text-rose-800"
            >
              {deviationMessage(d.statCode, d.from, d.to)}
            </p>
          ))}
          {outcome.trade && TRADE_NOTES[outcome.trade.status] && (
            <p className="mt-2 text-slate-600">{TRADE_NOTES[outcome.trade.status]}</p>
          )}
          {outcome.trade?.status === 'EXECUTED' && (
            <p className="mt-2 text-slate-600">
              {actionLabel(outcome.actual)} 금액 {won(outcome.trade.amount)}
            </p>
          )}
          {outcome.price && (
            <p className="mt-3">
              {outcome.price.sectorName} 주가{' '}
              <b className={outcome.price.direction === 'UP' ? 'text-red-600' : 'text-blue-600'}>
                {outcome.price.direction === 'UP' ? '▲' : '▼'} {percent(outcome.price.changeBp)}
              </b>
              {outcome.price.pnl !== 0 && (
                <>
                  {' · 손익 '}
                  <b className={outcome.price.pnl > 0 ? 'text-red-600' : 'text-blue-600'}>
                    {signedWon(outcome.price.pnl)}
                  </b>
                </>
              )}
            </p>
          )}
          {outcome.price?.lossSoftened && (
            <p className="mt-1 text-sm text-emerald-700">🍀 운 좋게 손실이 줄었다</p>
          )}
          {outcome.growth.map((g) => (
            <p key={g.statCode} className="mt-1 text-sm text-emerald-700">
              ↑ 경험으로 {statLabel(g.statCode)} {g.before} → {g.after}
            </p>
          ))}
        </>
      ) : (
        <p className="whitespace-pre-line text-lg" data-testid="outcome-message">
          {outcome.message}
        </p>
      )}
      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
        onClick={onContinue}
      >
        계속
      </button>
    </section>
  )
}
