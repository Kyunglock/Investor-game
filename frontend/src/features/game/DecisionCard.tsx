import { useState } from 'react'
import type { Game, PendingEvent } from '../../api/client'
import { won, yearOf } from './labels'
import {
  BUY_PERCENTS,
  quantityForCash,
  quantityForHolding,
  SELL_PERCENTS,
  signedPercent,
} from './market'
import { Overlay } from './Overlay'
import { Sparkline } from './Sparkline'

const KIND_LABELS: Record<PendingEvent['kind'], string> = {
  JOB: '직업',
  TRAIT: '일상',
  OFFER: '제안',
  LIFE: '생활',
  CAREER: '직장',
  NEWS: '뉴스',
  SHAKE: '흔들림',
  LEVERAGE: '빚투',
  HOUSING: '집',
}

/** 뉴스 매수의 기본 수량이 쓰는 현금 비율. 서버 기본(progress.news-buy-ratio-bp)과 같은 값이며, 사용자가 수량을 바꿀 수 있다. */
const NEWS_BUY_PERCENT = 30

/** 빚투 상한: 순자산의 이 비율까지 빌린다. 서버(progress.leverage-loan-bp)와 같은 값 (decisions.md 39번). */
const LEVERAGE_LOAN_PERCENT = 50
/** 빚투 수량 입력창의 기본값: 상한의 절반. 전에는 묻지 않고 상한을 다 빌렸다 (54번). */
const LEVERAGE_DEFAULT_PERCENT = 50

/** 수량을 묻는 선택지: 뉴스 매수·매도, 빚투. */
type Picker = 'BUY' | 'SELL' | 'BORROW'
const PICKER_LABEL: Record<Picker, string> = { BUY: '매수', SELL: '매도', BORROW: '빚투' }

interface Props {
  event: PendingEvent
  game: Game
  busy: boolean
  /** quantity는 뉴스의 매수·매도 수량. 관망과 뉴스가 아닌 선택에는 없다. */
  onChoose: (option: string, quantity?: number) => void
}

/** 선택형 이벤트 카드. 스킵할 수 없다. 게임을 멈추는 것은 종류를 가리지 않고 모두 화면을 어둡게 덮는 알림이다 (decisions.md 31번). */
export function DecisionCard(props: Props) {
  return (
    <Overlay>
      <Body {...props} />
    </Overlay>
  )
}

function Body({ event, game, busy, onChoose }: Props) {
  const isNews = event.kind === 'NEWS'
  // 흔들림: 보유 종목을 버틸지 팔지. 시세는 보여 주되 수량은 묻지 않는다(판다 = 전량) (decisions.md 33번).
  const isShake = event.kind === 'SHAKE'
  // 빚투: 크게 빠진 보유 종목에 대출을 얹을지. 판정 없이 고른 대로 한다 (decisions.md 39번).
  const isLeverage = event.kind === 'LEVERAGE'
  const holding = game.holdings.find((h) => h.stockCode === event.stockCode)
  const quote = game.market.stocks.find((s) => s.code === event.stockCode)
  const price = quote?.price ?? 0
  const age = game.startAge + Math.floor(event.occursDay / game.daysPerYear)
  const [picked, setPicked] = useState<string | null>(null)
  // 뉴스에서 매수·매도를, 빚투에서 빌린다를 누르면 바로 보내지 않고 수량을 묻는다. 관망·거절은 바로 보낸다.
  const [side, setSide] = useState<Picker | null>(null)
  const [quantity, setQuantity] = useState('')
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  // 빚투는 순자산(총자산)의 절반까지 빌릴 수 있다. 서버가 같은 상한으로 자른다 (decisions.md 39·54번).
  const maxLoan = Math.floor((Math.max(0, game.totalAsset) * LEVERAGE_LOAN_PERCENT) / 100)
  const fill = (percent: number) =>
    setQuantity(
      String(
        side === 'BUY'
          ? quantityForCash(game.cash, price, percent)
          : side === 'BORROW'
            ? quantityForCash(maxLoan, price, percent)
            : quantityForHolding(holding?.quantity ?? 0, percent),
      ),
    )
  const canSubmit =
    !busy &&
    qty >= 1 &&
    (side === 'BUY'
      ? qty * price <= game.cash
      : side === 'BORROW'
        ? qty * price <= maxLoan
        : qty <= (holding?.quantity ?? 0))

  const pick = (code: string) => {
    if (isNews && (code === 'BUY' || code === 'SELL')) {
      setSide(code)
      setQuantity(
        String(
          code === 'BUY'
            ? quantityForCash(game.cash, price, NEWS_BUY_PERCENT)
            : (holding?.quantity ?? 0),
        ),
      )
      return
    }
    if (isLeverage && code === 'BORROW') {
      setSide('BORROW')
      setQuantity(String(quantityForCash(maxLoan, price, LEVERAGE_DEFAULT_PERCENT)))
      return
    }
    setSide(null)
    setPicked(code)
    onChoose(code)
  }

  return (
    <section
      className="rounded-md border border-line bg-card px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      data-testid="event-card"
      data-kind={event.kind}
    >
      <div className="flex items-baseline justify-between text-[11px] font-bold text-wine">
        <span>
          {KIND_LABELS[event.kind]}
          {event.sectorName && ` · ${event.sectorName}`}
          {event.stockName && ` · ${event.stockName}`}
          {isNews && event.sectorWide && (
            <span className="font-normal text-faint"> · 섹터 전체</span>
          )}
        </span>
        <span className="font-mono-num font-normal text-faint">
          {age}세 · {yearOf(age)}년
        </span>
      </div>
      <h2 className="mt-2 font-serif-kr text-[22px] font-black leading-snug">{event.title}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed">{event.body}</p>

      {(isNews || isShake || isLeverage) && quote && (
        <div
          className="mt-3 flex items-center gap-3 rounded border border-line-soft px-2.5 py-2"
          data-testid="news-quote"
        >
          {event.spark && event.spark.length > 1 && (
            <Sparkline values={event.spark} width={120} height={32} className="flex-none" />
          )}
          <div className="min-w-0">
            <p className="font-mono-num text-[13px] font-semibold">{won(quote.price)}</p>
            <p className="text-[11px] text-faint">
              1개월{' '}
              <span className={tone(quote.change1mBp)}>{signedPercent(quote.change1mBp)}</span>
              {' · 12개월 '}
              <span className={tone(quote.change12mBp)}>{signedPercent(quote.change12mBp)}</span>
              {holding &&
                ` · 보유 ${holding.quantity}주 (평단 ${holding.avgCost.toLocaleString('ko-KR')})`}
            </p>
          </div>
        </div>
      )}

      {(isNews || isLeverage) && event.hint && (
        <p
          className="mt-3 border-l-[3px] border-teal bg-teal-soft px-2.5 py-2 font-mono-num text-xs text-[#3b5a52]"
          data-testid="hint"
        >
          {/* 빚투 제안의 힌트는 매매창과 같은, 그 종목에 대한 내 안목 해석이다 (decisions.md 53번) */}
          {isLeverage && (
            <span className="mr-1 text-[10px] text-faint">내 안목으로 본 {event.stockName}</span>
          )}
          {event.hint}
        </p>
      )}
      {isNews && event.sway && (
        <div className="mt-2.5 border-l-[3px] border-line px-2.5 py-1.5 text-xs text-muted">
          <p className="text-[10px] text-faint">다른 뉴스</p>
          <p>{event.sway}</p>
        </div>
      )}

      <div
        className={`mt-3 grid gap-2 ${isNews ? 'grid-cols-3' : isShake || isLeverage ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        {event.options.map((option) => {
          // 주거 선택지는 서버가 돈이 모자라거나 DSR에 걸리면 막아서 이유와 함께 보낸다 (주거 설계 4절).
          const disabled =
            busy || (isNews && option.code === 'SELL' && !holding) || Boolean(option.blocked)
          const active = picked === option.code || side === option.code
          const sub =
            isNews && option.code === 'BUY'
              ? `현금 ${won(game.cash)}`
              : (isNews || isShake) && option.code === 'SELL' && holding
                ? `보유 ${holding.quantity}주 ≈ ${won(holding.value)}`
                : isLeverage && option.code === 'BORROW'
                  ? `최대 ${won(maxLoan)} · 월 이자 1.5%`
                  : null
          return (
            <button
              key={option.code}
              type="button"
              disabled={disabled}
              aria-pressed={side === option.code}
              className={`min-h-12 rounded border px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'border-wine bg-wine-soft' : 'border-line bg-card hover:bg-bg'
              }`}
              onClick={() => pick(option.code)}
            >
              {option.label}
              {sub && (
                <span className="block font-mono-num text-[11px] font-normal text-faint">
                  {sub}
                </span>
              )}
              {option.detail && (
                <span className="block text-[11px] font-normal text-faint">{option.detail}</span>
              )}
              {option.blocked && (
                <span className="block text-[11px] font-normal text-wine">{option.blocked}</span>
              )}
            </button>
          )
        })}
      </div>

      {side && (
        <div
          className="mt-2.5 rounded border border-line bg-bg px-3 py-2.5"
          data-testid="news-trade"
        >
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted">{PICKER_LABEL[side]} 수량</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              className="min-h-10 w-full rounded border border-line bg-card px-2.5 text-right font-mono-num text-base"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="news-trade-quantity"
              aria-label="수량"
            />
            <span className="text-xs text-muted">주</span>
          </label>
          <div className={`mt-2 grid gap-1.5 ${side === 'SELL' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {(side === 'SELL' ? SELL_PERCENTS : BUY_PERCENTS).map((p) => (
              <button
                key={p}
                type="button"
                className="min-h-8 rounded border border-line bg-card font-mono-num text-[11px] hover:bg-bg"
                onClick={() => fill(p)}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="mt-2 flex justify-between text-xs text-muted">
            <span>{side === 'BORROW' ? '대출 금액' : '주문 금액'}</span>
            <b className="font-mono-num text-sm text-ink">{won(qty * price)}</b>
          </p>
          <button
            type="button"
            className="mt-2.5 min-h-11 w-full rounded bg-wine text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => {
              setPicked(side)
              onChoose(side, qty)
            }}
            data-testid="news-trade-submit"
          >
            {PICKER_LABEL[side]} 확정
          </button>
        </div>
      )}

      <p className="mt-3 text-[11px] text-faint">
        {event.kind === 'TRAIT'
          ? '일상의 선택은 성격에 뒤집히지 않습니다. 고른 대로 자랍니다.'
          : event.kind === 'LIFE'
            ? '삶의 선택은 성격에 뒤집히지 않습니다.'
            : isShake
              ? '버티려 해도 인내심이 없으면 손이 먼저 팔고, 팔려 해도 용기가 없으면 그대로 둡니다.'
              : '선택은 당신이 하지만, 실행은 당신의 성격이 합니다.'}
      </p>
    </section>
  )
}

function tone(bp: number): string {
  return bp > 0 ? 'text-up' : bp < 0 ? 'text-down' : ''
}
