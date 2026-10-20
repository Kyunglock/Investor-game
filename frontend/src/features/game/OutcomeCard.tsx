import { useEffect, useState } from 'react'
import type { Outcome, Stats } from '../../api/client'
import { ageAt } from './clock'
import {
  actionLabel,
  actionLabelFor,
  deviationMessage,
  growthText,
  percent,
  signedWon,
  TRADE_NOTES,
  won,
} from './labels'
import { Overlay } from './Overlay'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'
import { useGameStore } from './store'

/** 뉴스 선택 뒤 결과를 감추고 성격이 손을 움직이는 동안 기다리는 시간. 바로 나오면 억울할 틈이 없다. */
const REVEAL_MS = 1_800

/** 선택 → 실제 행동과 그 원인을 보여 준다. 원인이 보여야 억울함이 동기가 된다 (prd.md F6). 결과도 선택처럼 화면을 덮는다 (decisions.md 31번). */
export function OutcomeCard(props: {
  outcome: Outcome
  onReveal: () => void
  onContinue: () => void
}) {
  return (
    <Overlay>
      <Body {...props} />
    </Overlay>
  )
}

function Body({
  outcome,
  onReveal,
  onContinue,
}: {
  outcome: Outcome
  onReveal: () => void
  onContinue: () => void
}) {
  const deviated = outcome.chosen !== outcome.actual
  const price = outcome.price
  // 뉴스와 흔들림은 판정이 손을 움직이므로 잠깐 뜸을 들인다. 성장기·직업·제안은 뒤집히지 않으니 바로 보여 준다.
  const isNews = outcome.kind === 'NEWS' || outcome.kind === 'SHAKE'
  const [revealed, setRevealed] = useState(!isNews)
  useEffect(() => {
    if (revealed) {
      // 결과를 드러낸 뒤에야 총자산·보유를 바꾼다. "실행 중"에 숫자가 먼저 움직이면 결과가 샌다.
      onReveal()
      return
    }
    const id = setTimeout(() => setRevealed(true), REVEAL_MS)
    return () => clearTimeout(id)
  }, [revealed, onReveal])

  return (
    <section
      className="rounded-md border border-line bg-card px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      data-testid="outcome-card"
      data-revealed={revealed}
    >
      {isNews ? (
        <>
          <p className="text-[11px] font-bold text-wine">{revealed ? '결과' : '실행 중'}</p>
          {revealed ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <Face deviation={deviated ? outcome.deviations[0]?.statCode : null} />
                <div className="min-w-0">
                  <p className="font-serif-kr text-xl font-black" data-testid="outcome-actions">
                    선택 {actionLabelFor(outcome.kind, outcome.chosen)}{' '}
                    <span className="text-faint">→</span> 실제{' '}
                    <span className={deviated ? 'text-wine' : ''}>
                      {actionLabelFor(outcome.kind, outcome.actual)}
                    </span>
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-bold ${deviated ? 'text-wine' : 'text-teal'}`}
                    data-testid="outcome-verdict"
                  >
                    {deviated ? '성격이 선택을 뒤집었다' : '성격이 선택을 그대로 따랐다'}
                  </p>
                </div>
              </div>
              {outcome.deviations.map((d) => (
                <p
                  key={`${d.statCode}-${d.from}-${d.to}`}
                  className="mt-2 border-l-[3px] border-wine bg-wine-soft px-2.5 py-1.5 text-[13px] text-wine"
                >
                  {deviationMessage(d.statCode, d.from, d.to, d.source)}
                </p>
              ))}
              {outcome.trade && TRADE_NOTES[outcome.trade.status] && (
                <p className="mt-2 text-[13px] text-muted">{TRADE_NOTES[outcome.trade.status]}</p>
              )}
              {outcome.trade?.status === 'EXECUTED' && (
                <p className="mt-2 text-[13px] text-muted">
                  {actionLabel(outcome.actual)}{' '}
                  <span className="font-mono-num">
                    {outcome.trade.quantity.toLocaleString('ko-KR')}주 × {won(outcome.trade.price)}{' '}
                    = {won(outcome.trade.amount)}
                  </span>
                  {outcome.trade.realizedPnl != null && outcome.trade.realizedPnl !== 0 && (
                    <>
                      {' · 실현 '}
                      <span
                        className={`font-mono-num ${outcome.trade.realizedPnl > 0 ? 'text-up' : 'text-down'}`}
                      >
                        {signedWon(outcome.trade.realizedPnl)}
                      </span>
                    </>
                  )}
                </p>
              )}
              {price && (
                <p className="mt-3 text-[13px]">
                  {price.stockName ?? price.sectorName} 주가{' '}
                  <b
                    className={`font-mono-num ${price.direction === 'UP' ? 'text-up' : 'text-down'}`}
                  >
                    {price.direction === 'UP' ? '▲' : '▼'} {percent(price.changeBp)}
                  </b>
                  {price.pnl !== 0 && (
                    <>
                      {' · 내 손익 '}
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
            </>
          ) : (
            <div className="mt-2 flex items-center gap-3" data-testid="outcome-thinking">
              <Face deviation={null} />
              <p className="font-serif-kr text-lg font-black">
                {actionLabelFor(outcome.kind, outcome.chosen)}를 골랐다.{' '}
                <span className="text-muted">손이 움직이는데…</span>
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="whitespace-pre-line text-[15px]" data-testid="outcome-message">
          {outcome.message}
        </p>
      )}
      {revealed &&
        outcome.growth.map((g) => (
          <p
            key={g.statCode}
            className={`mt-1 text-xs ${g.after < g.before ? 'text-wine' : 'text-teal'}`}
            data-testid="outcome-growth"
          >
            {growthText(g.statCode, g.before, g.after, g.reason)}
          </p>
        ))}
      {revealed && (
        <button
          type="button"
          className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
          onClick={onContinue}
        >
          계속
        </button>
      )}
    </section>
  )
}

/**
 * 내 캐릭터의 얼굴. 선택이 뒤집혔으면 그 원인 능력치의 약점 표시(식은땀, 큰 귀, 화 자국…)를 띄워 누가 손을 움직였는지 보인다.
 * 그대로 따랐으면 표시 없이 평소 얼굴이다.
 */
function Face({ deviation }: { deviation: string | null | undefined }) {
  const game = useGameStore((s) => s.game)
  const day = useGameStore((s) => s.day)
  if (!game) {
    return null
  }
  const ageYears = ageAt(game.startAge, day, game.daysPerYear).years
  const base = layersFor(game.initialStats, game.stats, ageYears)
  const spec = { ...base, mark: (deviation as keyof Stats | null | undefined) ?? null }
  return (
    <Sprite
      spec={spec}
      size={56}
      crop="face"
      className="flex-none rounded border border-line-soft bg-bg"
    />
  )
}
