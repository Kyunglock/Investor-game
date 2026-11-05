import { useEffect, useState } from 'react'
import type { Run, RunOutcome } from '../../api/client'
import { signedWon } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { TUG_DONE_MS, TugOfWar } from '../game/TugOfWar'
import type { Matchup } from '../game/tug'
import { STAT_NAMES, shareOf } from './grades'

const ACTION_LABELS: Record<string, string> = {
  BUY: '산다',
  BUY_SMALL: '조금 산다',
  BUY_BIG: '크게 산다',
  SELL: '판다',
  HOLD: '지켜본다',
}

/** 판정에서 맞붙는 성질: 사기·팔기 → 지켜보기(크게 → 조금)는 용기 vs 망설임, 지켜보기 → 팔기는 인내심 vs 조급함, 나머지는 줏대 vs 꼬드김. */
const TRAITS: Record<string, [string, string]> = {
  courage: ['용기', '망설임'],
  patience: ['인내심', '조급함'],
  conviction: ['줏대', '꼬드김'],
}

/** 결과 앞의 맞대결 (decisions.md 181번). 뒤집혔으면 실제 선택이 상대이고, 아니면 가장 흔히 뒤집히는 쪽이 상대다. */
export function matchupOf(outcome: RunOutcome, run: Run): Matchup {
  const won = outcome.chosen === outcome.actual
  const flip = outcome.flips[0]
  const stat = (flip?.statCode ??
    (outcome.chosen === 'HOLD' ? 'conviction' : 'courage')) as Matchup['stat']
  const rivalAction = won
    ? outcome.chosen === 'HOLD'
      ? 'BUY_SMALL'
      : outcome.chosen === 'BUY_BIG'
        ? 'BUY_SMALL'
        : 'HOLD'
    : outcome.actual
  const [mine, rival] = TRAITS[stat]
  return {
    stat,
    mine: { action: ACTION_LABELS[outcome.chosen] ?? outcome.chosen, trait: mine },
    rival: { action: ACTION_LABELS[rivalAction] ?? rivalAction, trait: rival },
    start: Math.min(80, Math.max(20, shareOf(run.grades[stat]))),
    won,
  }
}

/** 카드 한 장의 결과. 뉴스면 맞대결이 끝난 뒤에 결과가 드러난다. */
export function RunOutcomeCard({
  outcome,
  run,
  onContinue,
}: {
  outcome: RunOutcome
  run: Run
  onContinue: () => void
}) {
  const news = outcome.kind === 'NEWS'
  const [revealed, setRevealed] = useState(!news)
  useEffect(() => {
    if (!news) {
      return
    }
    const id = setTimeout(() => setRevealed(true), TUG_DONE_MS + 300)
    return () => clearTimeout(id)
  }, [news])
  const flipped = outcome.chosen !== outcome.actual
  return (
    <Overlay>
      <section
        className="rounded bg-card p-5 font-note text-pen shadow-xl"
        data-testid="run-outcome"
        data-flipped={flipped}
      >
        {news && <TugOfWar matchup={matchupOf(outcome, run)} />}
        {revealed && (
          <div className="animate-reveal">
            {news && (
              <p className={`mt-3 text-[16px] font-bold ${flipped ? 'text-wine' : ''}`}>
                고른 것: {ACTION_LABELS[outcome.chosen]} → 실제: {ACTION_LABELS[outcome.actual]}
              </p>
            )}
            {outcome.tip && (
              <p
                className="mt-2 rounded bg-sticky px-3 py-2 text-[13px] text-ink"
                data-testid="flip-tip"
              >
                {outcome.tip}
              </p>
            )}
            {outcome.ifChosen != null && outcome.actualPnl != null && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-center" data-testid="what-if">
                <div className="rounded border border-line p-2">
                  <p className="text-[12px] text-muted">고른 대로 했다면</p>
                  <p className="font-mono-num text-[18px] font-bold">
                    {signedWon(outcome.ifChosen)}
                  </p>
                </div>
                <div className="rounded border border-wine p-2">
                  <p className="text-[12px] text-muted">실제로는</p>
                  <p className="font-mono-num text-[18px] font-bold text-wine">
                    {signedWon(outcome.actualPnl)}
                  </p>
                </div>
                <p className="col-span-2 text-[12px] text-muted">
                  {outcome.actualPnl > outcome.ifChosen
                    ? '뒤집혀서 오히려 다행이다.'
                    : outcome.actualPnl < outcome.ifChosen
                      ? '손만 안 떨렸어도…'
                      : '결과는 같았다.'}
                </p>
              </div>
            )}
            {outcome.trade && (
              <p className="mt-3 text-[13px]">
                {outcome.trade.side === 'BUY' ? '샀다' : '팔았다'}:{' '}
                {outcome.trade.quantity.toLocaleString()}주 × {outcome.trade.price.toLocaleString()}
                원{outcome.trade.deferred && ' (앱이 없어 다음 장 가격에 팔렸다)'}
              </p>
            )}
            {outcome.price && (
              <p className="mt-1 text-[13px]">
                주가{' '}
                <b className={outcome.price.up ? 'text-up' : 'text-down'}>
                  {outcome.price.up ? '▲' : '▼'} {Math.abs(outcome.price.changeBp / 100).toFixed(1)}
                  %
                </b>
                {outcome.actualPnl != null && outcome.actualPnl !== 0 && (
                  <> · 내 손익 {signedWon(outcome.actualPnl)}</>
                )}
              </p>
            )}
            {outcome.lines.map((line) => (
              <p key={line} className="mt-2 text-[14px]">
                {line}
              </p>
            ))}
            {outcome.decisive && (
              <p className="mt-3 border-l-4 border-gold pl-2 text-[13px]" data-testid="decisive">
                <span className="text-muted">복기 — 결정적 문장: </span>
                {outcome.decisive}
              </p>
            )}
            {outcome.growth.map((g) => (
              <p key={g.statCode} className="mt-1 text-[13px] text-teal">
                {STAT_NAMES[g.statCode]} {g.delta > 0 ? '조금 자랐다' : '조금 줄었다'}
                {g.before !== g.after && ` (${g.before} → ${g.after})`}
              </p>
            ))}
            <button
              type="button"
              onClick={onContinue}
              className="mt-4 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
              data-testid="continue"
            >
              계속
            </button>
          </div>
        )}
      </section>
    </Overlay>
  )
}
