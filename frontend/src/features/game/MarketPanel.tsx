import { useEffect, useMemo, useState } from 'react'
import type { Game, Indicator, NewsItem, StockAnalysis, TradeSide } from '../../api/client'
import { AnalysisNote } from './AnalysisNote'
import { indicatorChange, indicatorValue, newsMarkers, stockNews } from './analysis'
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
import { HELD_TAB, MACRO_TAB, useGameStore } from './store'

const NEWS_SHOWN = 6
const NEWSPAPER_SHOWN = 5
/** 시황 탭에 보이는 지표. 나머지는 해석 문구 안에서만 쓰인다 (매매창 설계 2.2절). */
const MACRO_INDICATORS = ['index', 'sentiment']

/**
 * 매매창 (매매창 설계 2절): 시황 탭(거시 지표·경제 신문·안목 해석)과 종목 탭(보유·섹터 → 차트·추세·종목 뉴스·주문). 열려 있는 동안 시계는 멈춰 있고,
 * 연 순간 도착한 이벤트에도 닫히지 않는다. 결정 카드(z-20)보다 위에 뜬다.
 */
export function MarketPanel({ game }: { game: Game }) {
  const tab = useGameStore((s) => s.marketTab)
  const { setMarketTab, closeMarket } = useGameStore.getState()

  const sectors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of game.market.stocks) {
      seen.set(s.sectorCode, s.sectorName)
    }
    return [...seen.entries()].map(([code, name]) => ({ code, name }))
  }, [game.market.stocks])
  const age = ageAt(game.startAge, game.day, game.daysPerYear).years
  const monthLabel = `${yearOf(age)}년 ${Math.floor(game.market.month % 12) + 1}월`

  const tabClass = (active: boolean, accent: 'wine' | 'ink') =>
    `min-h-9 rounded border px-2.5 text-xs ${
      active
        ? accent === 'wine'
          ? 'border-wine bg-wine font-bold text-white'
          : 'border-ink bg-ink text-white'
        : accent === 'wine'
          ? 'border-wine bg-card font-bold text-wine hover:bg-wine-soft'
          : 'border-line bg-card hover:bg-bg'
    }`

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[rgba(30,40,40,0.45)] px-2 py-6 sm:px-4 sm:py-10">
      <section
        className="animate-reveal w-full max-w-[980px] overflow-hidden rounded-md border border-line bg-card shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        data-testid="market-panel"
        aria-label="매매창"
      >
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="font-serif-kr text-xl font-black">
            매매창{' '}
            <span className="ml-1 font-mono-num text-xs font-normal text-faint">
              {monthLabel} · {age}세 · ❚❚ 시간 멈춤
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

        <div className="flex flex-wrap gap-1 border-b border-line-soft px-4 py-3">
          <button
            type="button"
            aria-pressed={tab === MACRO_TAB}
            className={tabClass(tab === MACRO_TAB, 'ink')}
            onClick={() => setMarketTab(MACRO_TAB)}
            data-testid="macro-tab"
          >
            시황
          </button>
          <button
            type="button"
            aria-pressed={tab === HELD_TAB}
            className={tabClass(tab === HELD_TAB, 'wine')}
            onClick={() => setMarketTab(HELD_TAB)}
            data-testid="held-tab"
          >
            보유 {game.holdings.length}
          </button>
          {sectors.map((s) => (
            <button
              key={s.code}
              type="button"
              aria-pressed={tab === s.code}
              className={tabClass(tab === s.code, 'ink')}
              onClick={() => setMarketTab(s.code)}
            >
              {s.name}
              {game.interestSector?.code === s.code && (
                <span
                  className={`ml-1 rounded-full border px-1.5 text-[10px] ${
                    tab === s.code ? 'border-white' : 'border-wine text-wine'
                  }`}
                >
                  관심
                </span>
              )}
            </button>
          ))}
        </div>

        {game.pendingEvent && (
          <p
            className="border-b border-line-soft bg-wine-soft px-4 py-1.5 text-[11px] text-wine"
            data-testid="market-pending-note"
          >
            기다리는 선택이 있다. 매매창을 닫으면 보인다.
          </p>
        )}

        {tab === MACRO_TAB ? <MacroTab game={game} /> : <StockTab game={game} tab={tab} />}
      </section>
    </div>
  )
}

// ---- 시황 탭 (매매창 설계 2.2절) ----

function MacroTab({ game }: { game: Game }) {
  const overview = useGameStore((s) => s.overview)
  const shown = overview?.indicators.filter((i) => MACRO_INDICATORS.includes(i.code)) ?? []
  return (
    <div className="px-4 py-4" data-testid="macro-tab-body">
      <AnalysisNote title="내가 읽은 경제" analysis={overview?.analysis} testId="macro-analysis" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {overview
          ? shown.map((i) => <IndicatorLine key={i.code} indicator={i} />)
          : MACRO_INDICATORS.map((code) => (
              <div
                key={code}
                className="h-12 animate-pulse rounded border border-line-soft bg-bg"
              />
            ))}
      </div>
      <div className="mt-4">
        <Newspaper game={game} items={overview?.newspaper ?? []} />
      </div>
    </div>
  )
}

/** 값과 1년 변화만. 색은 방향만 보여 준다. */
function IndicatorLine({ indicator }: { indicator: Indicator }) {
  const change = indicatorChange(indicator.unit, indicator.value, indicator.yearAgo)
  const up = change.startsWith('+')
  const down = change.startsWith('−')
  return (
    <div
      className="flex items-baseline justify-between rounded border border-line-soft bg-bg px-2.5 py-2"
      data-testid="indicator"
      data-code={indicator.code}
    >
      <span className="text-[11px] text-faint">{indicator.name}</span>
      <span className="font-mono-num text-[15px] font-semibold">
        {indicatorValue(indicator.unit, indicator.value)}
        <small
          className={`ml-1.5 text-[10px] font-normal ${up ? 'text-up' : down ? 'text-down' : 'text-muted'}`}
        >
          1년 {change}
        </small>
      </span>
    </div>
  )
}

/** 전조·헛소문·기사·회고를 구분 없이 최근 순으로. 꼬리표가 없어야 소문만 보고 판단할 수 없다 (매매창 설계 3.3절). */
function Newspaper({ game, items }: { game: Game; items: NewsItem[] }) {
  const recent = [...items].reverse()
  const shown = recent.slice(0, NEWSPAPER_SHOWN)
  const rest = recent.slice(NEWSPAPER_SHOWN)
  const ageOf = (day: number) => game.startAge + Math.floor(day / game.daysPerYear)
  const line = (item: NewsItem, i: number) => (
    <li
      key={`${item.day}-${i}`}
      className="grid grid-cols-[34px_1fr] gap-2 border-b border-line-soft py-1.5 text-[12px] last:border-b-0"
      data-testid="newspaper-line"
    >
      <span className="pt-0.5 font-mono-num text-[11px] text-faint">{ageOf(item.day)}세</span>
      <span className={item.kind === 'CRISIS' ? 'text-wine' : ''}>{item.text}</span>
    </li>
  )
  return (
    <section data-testid="newspaper">
      <h3 className="font-serif-kr text-sm font-black">경제 신문</h3>
      {recent.length === 0 ? (
        <p className="mt-2 text-xs text-faint">아직 들린 소식이 없다.</p>
      ) : (
        <ul className="m-0 mt-1 list-none p-0">{shown.map(line)}</ul>
      )}
      {rest.length > 0 && (
        <details className="mt-1 text-xs text-muted">
          <summary className="cursor-pointer py-1">지난 소식 ({rest.length}건)</summary>
          <ul className="m-0 list-none p-0">{rest.map(line)}</ul>
        </details>
      )}
    </section>
  )
}

// ---- 종목 탭 (매매창 설계 2.1절) ----

function StockTab({ game, tab }: { game: Game; tab: string }) {
  const selected = useGameStore((s) => s.selectedStock)
  const { selectStock } = useGameStore.getState()
  const heldCodes = new Set(game.holdings.map((h) => h.stockCode))
  const heldTab = tab === HELD_TAB
  const listed = heldTab
    ? game.market.stocks.filter((s) => heldCodes.has(s.code))
    : game.market.stocks.filter((s) => s.sectorCode === tab)
  const selectedQuote = game.market.stocks.find((s) => s.code === selected)

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-[10px] text-faint">
              <th className="border-b border-line px-4 pb-1.5 pt-2 text-left font-normal">종목</th>
              <th className="border-b border-line pb-1.5 pt-2 text-right font-normal">현재가</th>
              <th className="border-b border-line pb-1.5 pt-2 text-right font-normal">1개월</th>
              <th className="border-b border-line pb-1.5 pt-2 text-right font-normal">
                {heldTab ? '내 수익률' : '12개월'}
              </th>
              <th className="border-b border-line pr-4 pb-1.5 pt-2 text-right font-normal">
                최근 12달
              </th>
            </tr>
          </thead>
          <tbody>
            {heldTab && listed.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-faint">
                  아직 보유 종목이 없다. 섹터 탭에서 골라 사 보자.
                </td>
              </tr>
            )}
            {listed.map((s) => {
              const owned = heldCodes.has(s.code)
              const mine = game.holdings.find((h) => h.stockCode === s.code)
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
                    {heldTab && mine && (
                      <span className="ml-1.5 font-mono-num text-[10px] font-normal text-faint">
                        {mine.quantity.toLocaleString('ko-KR')}주 · 평단{' '}
                        {mine.avgCost.toLocaleString('ko-KR')}
                      </span>
                    )}
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
                    className={`border-b border-line-soft py-2.5 text-right font-mono-num ${tone(heldTab && mine ? mine.pnlBp : s.change12mBp)}`}
                  >
                    {signedPercent(heldTab && mine ? mine.pnlBp : s.change12mBp)}
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

      <div className="border-t border-line px-5 py-4 md:border-t-0 md:border-l">
        {selectedQuote ? (
          <StockDetail game={game} code={selectedQuote.code} />
        ) : (
          <p className="text-xs text-faint">종목을 고르세요.</p>
        )}
      </div>
    </div>
  )
}

function StockDetail({ game, code }: { game: Game; code: string }) {
  const histories = useGameStore((s) => s.histories)
  const analyses = useGameStore((s) => s.analyses)
  const quote = game.market.stocks.find((s) => s.code === code)
  const analysis = analyses[code]
  const age = ageAt(game.startAge, game.day, game.daysPerYear).years
  const news = useMemo(() => stockNews(game, code), [game, code])
  const held = game.holdings.find((h) => h.stockCode === code)
  if (!quote) {
    return null
  }
  return (
    <>
      <h3 className="font-serif-kr text-lg font-black">
        {quote.name}{' '}
        <span className="ml-1 font-mono-num text-xs font-normal text-faint">
          {quote.sectorName}
        </span>
      </h3>
      <p className="mt-1 font-mono-num text-[22px] font-semibold">
        {won(quote.price)}{' '}
        <small className={`ml-1 text-xs ${tone(quote.change1mBp)}`}>
          {quote.change1mBp >= 0 ? '▲' : '▼'} {signedPercent(Math.abs(quote.change1mBp))}
        </small>
      </p>
      <div className="my-2">
        <PriceChart
          history={histories[code]}
          startAge={game.startAge}
          currentAge={age}
          markers={newsMarkers(news)}
        />
        <p className="flex gap-3 text-[10px] text-faint">
          <span>
            <i className="mr-1 inline-block h-[2px] w-3 bg-teal align-middle" />
            가격
          </span>
          <span>
            <i className="mr-1 inline-block h-[2px] w-3 bg-gold align-middle" />
            6개월선
          </span>
          <span>
            <i className="mr-1 inline-block h-[2px] w-3 bg-down align-middle" />
            12개월선
          </span>
          <span>● 뉴스·흔들림·내 매매</span>
        </p>
      </div>

      <Facts analysis={analysis} price={quote.price} />
      <div className="mt-2">
        <AnalysisNote title="추세 읽기" analysis={analysis?.analysis} testId="trend-analysis" />
      </div>
      <StockNews news={news} />

      <p className="mt-3 flex justify-between rounded bg-bg px-2.5 py-1.5 text-xs">
        {held ? (
          <>
            <span>
              내 보유 {held.quantity.toLocaleString('ko-KR')}주 · 평단{' '}
              {held.avgCost.toLocaleString('ko-KR')}
            </span>
            <b className={`font-mono-num ${tone(held.pnlBp)}`}>{signedPercent(held.pnlBp)}</b>
          </>
        ) : (
          <span className="text-faint">보유 없음</span>
        )}
      </p>
      <OrderBox game={game} code={code} price={quote.price} heldQuantity={held?.quantity ?? 0} />
    </>
  )
}

/** 숫자는 안목과 상관없이 정확하다. 해석이 숫자와 어긋나면 알아챌 수 있게 나란히 둔다 (매매창 설계 2.1절). */
function Facts({ analysis, price }: { analysis: StockAnalysis | undefined; price: number }) {
  if (!analysis) {
    return <div className="h-12 animate-pulse rounded bg-bg" />
  }
  const f = analysis.facts
  const vsMa = price > f.ma12 ? '위' : price < f.ma12 ? '아래' : '같음'
  const cell = (label: string, value: string, cls = '') => (
    <div className="rounded border border-line-soft px-2 py-1">
      <p className="text-[10px] text-faint">{label}</p>
      <p className={`font-mono-num text-[12px] ${cls}`}>{value}</p>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-1.5 text-xs" data-testid="trend-facts">
      {cell(
        '12개월선',
        `${f.ma12.toLocaleString('ko-KR')} · ${vsMa} ${Math.max(1, Math.abs(f.monthsVsMa12))}달째`,
      )}
      {cell('6개월선', f.ma6.toLocaleString('ko-KR'))}
      {cell('고점 대비', `−${(f.dropFromHighBp / 100).toFixed(1)}%`, tone(-f.dropFromHighBp))}
      {cell(
        '1년 최고 / 최저',
        `${f.high12.toLocaleString('ko-KR')} / ${f.low12.toLocaleString('ko-KR')}`,
      )}
      {cell('최근 3달', signedPercent(f.change3mBp), tone(f.change3mBp))}
      {cell(
        '1년 · 섹터 평균',
        `${signedPercent(f.change12mBp)} · ${signedPercent(f.sectorChange12mBp)}`,
        tone(f.change12mBp),
      )}
    </div>
  )
}

function StockNews({ news }: { news: ReturnType<typeof stockNews> }) {
  const shown = news.slice(0, NEWS_SHOWN)
  const rest = news.slice(NEWS_SHOWN)
  const line = (item: (typeof news)[number]) => (
    <li
      key={item.seq}
      className="grid grid-cols-[34px_1fr] gap-2 border-b border-line-soft py-1 text-[12px] last:border-b-0"
      data-testid="stock-news-line"
    >
      <span className="pt-0.5 font-mono-num text-[11px] text-faint">{item.age}세</span>
      <span className={item.kind === 'PRICE' ? 'text-muted' : ''}>{item.text}</span>
    </li>
  )
  return (
    <section className="mt-3" data-testid="stock-news">
      <h4 className="text-xs font-bold">종목 뉴스</h4>
      {news.length === 0 ? (
        <p className="mt-1 text-[11px] text-faint">이 종목에 얽힌 소식이 아직 없다.</p>
      ) : (
        <ul className="m-0 mt-1 list-none p-0">{shown.map(line)}</ul>
      )}
      {rest.length > 0 && (
        <details className="mt-1 text-xs text-muted">
          <summary className="cursor-pointer py-1">더 보기 ({rest.length}건)</summary>
          <ul className="m-0 list-none p-0">{rest.map(line)}</ul>
        </details>
      )}
    </section>
  )
}

function OrderBox({
  game,
  code,
  price,
  heldQuantity,
}: {
  game: Game
  code: string
  price: number
  heldQuantity: number
}) {
  const tradeOutcome = useGameStore((s) => s.tradeOutcome)
  const trading = useGameStore((s) => s.trading)
  const { trade } = useGameStore.getState()
  const [side, setSide] = useState<TradeSide>('BUY')
  const [quantity, setQuantity] = useState('')

  // 종목이 바뀌면 수량을 비운다.
  useEffect(() => {
    if (code) {
      setQuantity('')
    }
  }, [code])

  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const percents = side === 'BUY' ? BUY_PERCENTS : SELL_PERCENTS
  const fill = (percent: number) =>
    setQuantity(
      String(
        side === 'BUY'
          ? quantityForCash(game.cash, price, percent)
          : quantityForHolding(heldQuantity, percent),
      ),
    )
  const canSubmit =
    !trading && qty >= 1 && (side === 'BUY' ? qty * price <= game.cash : heldQuantity > 0)

  return (
    <>
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
      <div className={`mt-2 grid gap-1.5 ${side === 'BUY' ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
          주문 금액 · {side === 'BUY' ? `현금 ${won(game.cash)}` : `보유 ${heldQuantity}주`}
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
