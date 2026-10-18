import { useEffect, useMemo, useState } from 'react'
import type { Game, TradeSide } from '../../api/client'
import { ageAt } from './clock'
import { deviationMessage, growthText, sideLabel, won, yearOf } from './labels'
import {
  BUY_PERCENTS,
  quantityForCash,
  quantityForHolding,
  SELL_PERCENTS,
  signedPercent,
} from './market'
import { PriceChart } from './PriceChart'
import { Sparkline } from './Sparkline'
import { useGameStore } from './store'

/** 시장 패널: 섹터 탭 → 종목 → 차트와 주문 (경제 개편 설계 11.2절). 열려 있는 동안 시계는 멈춰 있다. */
export function MarketPanel({ game }: { game: Game }) {
  const selected = useGameStore((s) => s.selectedStock)
  const histories = useGameStore((s) => s.histories)
  const tradeOutcome = useGameStore((s) => s.tradeOutcome)
  const trading = useGameStore((s) => s.trading)
  const { selectStock, trade, closeMarket } = useGameStore.getState()

  const sectors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of game.market.stocks) {
      seen.set(s.sectorCode, s.sectorName)
    }
    return [...seen.entries()].map(([code, name]) => ({ code, name }))
  }, [game.market.stocks])
  const selectedQuote = game.market.stocks.find((s) => s.code === selected)
  const [sector, setSector] = useState(
    selectedQuote?.sectorCode ?? game.interestSector?.code ?? sectors[0]?.code ?? '',
  )
  const [side, setSide] = useState<TradeSide>('BUY')
  const [quantity, setQuantity] = useState('')

  // 종목이 바뀌면 수량과 결과를 비운다.
  useEffect(() => {
    if (selected) {
      setQuantity('')
    }
  }, [selected])

  const held = game.holdings.find((h) => h.stockCode === selected)
  const price = selectedQuote?.price ?? 0
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const age = ageAt(game.startAge, game.day, game.daysPerYear).years
  const monthLabel = `${yearOf(age)}년 ${Math.floor(game.market.month % 12) + 1}월`
  const percents = side === 'BUY' ? BUY_PERCENTS : SELL_PERCENTS
  const fill = (percent: number) =>
    setQuantity(
      String(
        side === 'BUY'
          ? quantityForCash(game.cash, price, percent)
          : quantityForHolding(held?.quantity ?? 0, percent),
      ),
    )
  const canSubmit = !trading && qty >= 1 && (side === 'BUY' ? qty * price <= game.cash : !!held)

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[rgba(30,40,40,0.45)] px-2 py-6 sm:px-4 sm:py-10">
      <section
        className="animate-reveal w-full max-w-[920px] overflow-hidden rounded-md border border-line bg-card shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        data-testid="market-panel"
        aria-label="시장"
      >
        <header className="flex items-baseline justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-serif-kr text-xl font-black">
            시장{' '}
            <span className="ml-1 font-mono-num text-xs font-normal text-faint">
              {monthLabel} · {age}세
            </span>
          </h2>
          <button
            type="button"
            className="min-h-10 rounded border border-line px-3 text-sm hover:bg-bg"
            onClick={closeMarket}
          >
            닫기 ✕
          </button>
        </header>

        <div className="grid md:grid-cols-[minmax(0,1fr)_340px]">
          {/* 종목 목록 */}
          <div>
            <div className="flex flex-wrap gap-1 px-4 pt-3">
              {sectors.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  aria-pressed={sector === s.code}
                  className={`min-h-9 rounded border px-2.5 text-xs ${
                    sector === s.code
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-card hover:bg-bg'
                  }`}
                  onClick={() => setSector(s.code)}
                >
                  {s.name}
                  {game.interestSector?.code === s.code && (
                    <span
                      className={`ml-1 rounded-full border px-1.5 text-[10px] ${
                        sector === s.code ? 'border-white' : 'border-wine text-wine'
                      }`}
                    >
                      관심
                    </span>
                  )}
                </button>
              ))}
            </div>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="text-[10px] text-faint">
                  <th className="border-b border-line px-4 pb-1.5 text-left font-normal">종목</th>
                  <th className="border-b border-line pb-1.5 text-right font-normal">현재가</th>
                  <th className="border-b border-line pb-1.5 text-right font-normal">1개월</th>
                  <th className="border-b border-line pb-1.5 text-right font-normal">12개월</th>
                  <th className="border-b border-line pr-4 pb-1.5 text-right font-normal">
                    최근 12달
                  </th>
                </tr>
              </thead>
              <tbody>
                {game.market.stocks
                  .filter((s) => s.sectorCode === sector)
                  .map((s) => {
                    const owned = game.holdings.some((h) => h.stockCode === s.code)
                    const active = s.code === selected
                    return (
                      <tr
                        key={s.code}
                        className={`cursor-pointer ${active ? 'bg-teal-soft' : 'hover:bg-bg'}`}
                        data-testid="stock-row"
                        data-stock={s.code}
                        onClick={() => void selectStock(s.code)}
                      >
                        <td className="border-b border-line-soft px-4 py-2.5 font-bold">
                          {owned && (
                            <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-wine align-middle" />
                          )}
                          {s.name}
                        </td>
                        <td className="border-b border-line-soft py-2.5 text-right font-mono-num">
                          {s.price.toLocaleString('ko-KR')}
                        </td>
                        <td
                          className={`border-b border-line-soft py-2.5 text-right font-mono-num ${tone(s.change1mBp)}`}
                        >
                          {signedPercent(s.change1mBp)}
                        </td>
                        <td
                          className={`border-b border-line-soft py-2.5 text-right font-mono-num ${tone(s.change12mBp)}`}
                        >
                          {signedPercent(s.change12mBp)}
                        </td>
                        <td className="border-b border-line-soft py-2.5 pr-4 text-right">
                          <Sparkline values={s.spark} />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            <p className="px-4 py-3 text-[11px] text-faint">
              ● 보유 중 · 가격은 매달 1일에 바뀌고, 뉴스가 터지면 그 위에 충격이 더해진다.
            </p>
          </div>

          {/* 상세와 주문 */}
          <div className="border-t border-line px-5 py-4 md:border-t-0 md:border-l">
            {selectedQuote ? (
              <>
                <h3 className="font-serif-kr text-lg font-black">
                  {selectedQuote.name}{' '}
                  <span className="ml-1 font-mono-num text-xs font-normal text-faint">
                    {selectedQuote.sectorName}
                  </span>
                </h3>
                <p className="mt-1 font-mono-num text-[22px] font-semibold">
                  {won(selectedQuote.price)}{' '}
                  <small className={`ml-1 text-xs ${tone(selectedQuote.change1mBp)}`}>
                    {selectedQuote.change1mBp >= 0 ? '▲' : '▼'}{' '}
                    {signedPercent(Math.abs(selectedQuote.change1mBp))}
                  </small>
                </p>
                <div className="my-2">
                  <PriceChart
                    history={histories[selectedQuote.code]}
                    startAge={game.startAge}
                    currentAge={age}
                  />
                </div>
                <p className="flex justify-between rounded bg-bg px-2.5 py-1.5 text-xs">
                  {held ? (
                    <>
                      <span>
                        내 보유 {held.quantity.toLocaleString('ko-KR')}주 · 평단{' '}
                        {held.avgCost.toLocaleString('ko-KR')}
                      </span>
                      <b className={`font-mono-num ${tone(held.pnlBp)}`}>
                        {signedPercent(held.pnlBp)}
                      </b>
                    </>
                  ) : (
                    <span className="text-faint">보유 없음</span>
                  )}
                </p>

                <div className="mt-3 grid grid-cols-2 overflow-hidden rounded border border-line">
                  {(['BUY', 'SELL'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={side === s}
                      className={`min-h-10 text-sm font-bold ${side === s ? 'bg-wine text-white' : 'bg-card hover:bg-bg'}`}
                      onClick={() => {
                        setSide(s)
                        setQuantity('')
                      }}
                    >
                      {sideLabel(s)}
                    </button>
                  ))}
                </div>
                <label className="mt-2.5 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="min-h-11 w-full rounded border border-line px-2.5 text-right font-mono-num text-base"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    data-testid="trade-quantity"
                    aria-label="수량"
                  />
                  <span className="text-xs text-muted">주</span>
                </label>
                <div
                  className={`mt-2 grid gap-1.5 ${side === 'BUY' ? 'grid-cols-4' : 'grid-cols-3'}`}
                >
                  {percents.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="min-h-9 rounded border border-line bg-card font-mono-num text-[11px] hover:bg-bg"
                      onClick={() => fill(p)}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 flex justify-between text-xs text-muted">
                  <span>
                    주문 금액 ·{' '}
                    {side === 'BUY' ? `현금 ${won(game.cash)}` : `보유 ${held?.quantity ?? 0}주`}
                  </span>
                  <b className="font-mono-num text-sm text-ink">{won(qty * price)}</b>
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 w-full rounded bg-wine text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canSubmit}
                  onClick={() => void trade(side, qty)}
                  data-testid="trade-submit"
                >
                  {sideLabel(side)} 주문
                </button>

                {tradeOutcome && <TradeResultLine game={game} />}
                <p className="mt-3 text-[11px] text-faint">
                  선택은 당신이 하지만, 실행은 당신의 성격이 합니다.
                </p>
              </>
            ) : (
              <p className="text-xs text-faint">종목을 고르세요.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/** 방금 낸 주문의 결과 한 줄. 이탈이면 와인색, 체결이면 청록. */
function TradeResultLine({ game }: { game: Game }) {
  const outcome = useGameStore((s) => s.tradeOutcome)
  if (!outcome) {
    return null
  }
  const stock = game.market.stocks.find((s) => s.code === useGameStore.getState().selectedStock)
  const deviated = outcome.deviations.length > 0
  const trade = outcome.trade
  let text: string
  if (deviated) {
    const d = outcome.deviations[0]
    text =
      d.statCode === 'courage'
        ? '용기 부족 — 주문 버튼을 누르려다 겁나서 그만뒀다.'
        : deviationMessage(d.statCode, d.from, d.to)
  } else if (trade?.status === 'EXECUTED') {
    text = `${stock?.name ?? ''} ${trade.quantity.toLocaleString('ko-KR')}주를 ${won(trade.price)}에 ${
      outcome.actual === 'SELL' ? '팔았다' : '샀다'
    }.${
      trade.realizedPnl != null && trade.realizedPnl !== 0
        ? ` 실현 손익 ${trade.realizedPnl > 0 ? '+' : ''}${won(trade.realizedPnl)}.`
        : ''
    }`
  } else if (trade?.status === 'INSUFFICIENT_CASH') {
    text = '현금이 부족해 사지 못했다.'
  } else {
    text = '팔 종목이 없었다.'
  }
  return (
    <output
      className={`mt-2.5 block border-l-[3px] px-2.5 py-2 text-xs ${
        deviated ? 'border-wine bg-wine-soft text-wine' : 'border-teal bg-teal-soft text-[#3b5a52]'
      }`}
      data-testid="trade-result"
    >
      {text}
      {outcome.growth.map((g) => (
        <span key={g.statCode} className="mt-0.5 block text-teal">
          {growthText(g.statCode, g.before, g.after, g.reason)}
        </span>
      ))}
    </output>
  )
}

function tone(bp: number): string {
  return bp > 0 ? 'text-up' : bp < 0 ? 'text-down' : ''
}
