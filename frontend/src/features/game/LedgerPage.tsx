import { useState } from 'react'
import type { Game } from '../../api/client'
import { percent, shortWon, signedShortWon, signedWon, won } from './labels'
import { changeBp, signedPercent } from './market'
import { useGameStore } from './store'
import { curvePoints } from './timeline'

/** 거주 형태 이름 (주거 설계 1절). */
export const TENURE_LABELS: Record<Game['housing']['tenure'], string> = {
  PARENTS: '부모님 집',
  MONTHLY: '월세',
  VILLA_JEONSE: '빌라 전세',
  APT_JEONSE: '아파트 전세',
  OWN: '자가',
}

/** 수첩 오른쪽 쪽: 돈 (2026-10-22 시안 D). 전 재산, 그래프, 가계부, 주식과 매매, 집. 금액은 모두 서버 값이다. */
export function LedgerPage({ game, ageYears }: { game: Game; ageYears: number }) {
  return (
    <section aria-label="돈" className="paper-grid min-w-0 flex-[1_1_440px] px-5 pt-6 pb-8 sm:px-8">
      <Worth game={game} />
      <Curve game={game} ageYears={ageYears} />
      <Household game={game} />
      <Stocks game={game} />
      <Home game={game} />
    </section>
  )
}

function Worth({ game }: { game: Game }) {
  const delta = game.lastMonthTotalAsset == null ? null : game.totalAsset - game.lastMonthTotalAsset
  return (
    <div data-testid="portfolio-card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-pen-soft">전 재산</p>
          <p
            className="pen-circle inline-block px-3.5 py-0.5 font-pen text-[46px] leading-tight text-red-pen sm:text-[54px]"
            data-testid="total-asset"
          >
            {shortWon(game.totalAsset)}
          </p>
        </div>
        {delta !== null && game.lastMonthTotalAsset != null && (
          <p
            className={`font-pen text-[24px] ${delta < 0 ? 'text-blue-pen' : 'text-red-pen'}`}
            data-testid="month-delta"
          >
            지난달보다 {signedShortWon(delta)} (
            {signedPercent(changeBp(game.totalAsset, game.lastMonthTotalAsset))})
          </p>
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[13px] text-pen-soft">
        <span>
          현금{' '}
          <b className="text-pen" data-testid="cash">
            {shortWon(game.cash)}
          </b>
        </span>
        <span>
          주식{' '}
          <b className="text-pen" data-testid="invested">
            {shortWon(game.invested)}
          </b>
        </span>
        <span>
          빚{' '}
          <b className={game.debt > 0 ? 'text-red-pen' : 'text-pen'} data-testid="debt">
            {shortWon(game.debt)}
          </b>
        </span>
      </p>
    </div>
  )
}

const W = 400
const H = 110
const BOTTOM = 96
const TOP = 10

/** 손으로 그은 듯한 재산 그래프. 점 사이를 곡선으로 잇는다. */
function Curve({ game, ageYears }: { game: Game; ageYears: number }) {
  const points = curvePoints(game.yearly, game.initialAsset, game.startAge, ageYears)
  const max = Math.max(...points.map((p) => p.totalAsset), 1)
  const span = Math.max(ageYears - game.startAge, 1)
  const x = (age: number) => 4 + ((age - game.startAge) / span) * (W - 40)
  const y = (v: number) => BOTTOM - (Math.max(v, 0) / max) * (BOTTOM - TOP)
  const xy = points.map((p) => [x(p.age), y(p.totalAsset)] as const)
  const path = xy
    .map(([px, py], i) => {
      if (i === 0) {
        return `M${px.toFixed(1)} ${py.toFixed(1)}`
      }
      const [qx, qy] = xy[i - 1]
      const mid = (qx + px) / 2
      return `C${mid.toFixed(1)} ${qy.toFixed(1)}, ${mid.toFixed(1)} ${py.toFixed(1)}, ${px.toFixed(1)} ${py.toFixed(1)}`
    })
    .join(' ')
  const [lx, ly] = xy[xy.length - 1]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="my-3 block h-auto w-full font-pen"
      role="img"
      aria-label="나이에 따른 전 재산"
    >
      <path d={path} fill="none" stroke="var(--pen)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--red-pen)" />
      <text x={2} y={H - 2} fontSize={14} fill="var(--pen-soft)">
        {game.startAge}살
      </text>
      <text
        x={Math.min(lx + 6, W - 30)}
        y={Math.max(ly + 4, 16)}
        fontSize={16}
        fill="var(--red-pen)"
      >
        지금
      </text>
    </svg>
  )
}

function Household({ game }: { game: Game }) {
  const h = game.household
  // 전업투자자는 월급만 없을 뿐 생활비가 나가므로 가계부를 보여 준다 (decisions.md 35번).
  const working = (game.job !== null && game.job !== undefined) || game.fullTimeInvestor
  // 자녀 비용은 생활비에 합쳐져 온다. 은퇴 뒤에는 월급 대신 연금. 주거비는 생활비와 따로 나간다 (주거 설계 2절).
  const saving =
    h.monthlyIncome + h.spouseIncome + h.pension - h.monthlyExpense - game.housing.monthlyCost
  const month = Math.floor(game.market.month % 12) + 1
  const family = h.married
    ? `부부${h.children.length > 0 ? ` · 자녀 ${h.children.map((c) => (c.leftHome ? `${c.age}살(독립)` : `${c.age}살`)).join(', ')}` : ''}`
    : '혼자'
  return (
    <section className="mt-2" data-testid="household-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">{month}월 가계부</h2>
      {!working ? (
        <p className="text-pen-soft">
          {game.phase === 'CHILDHOOD' ? '아직 부모님 집이다.' : '직업이 생기면 가계부가 시작된다.'}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {h.retired ? (
              <Row label="연금" value={h.pension} />
            ) : (
              <Row label="월급" value={h.monthlyIncome} />
            )}
            {h.married && <Row label="배우자 소득" value={h.spouseIncome} />}
            <Row label={`생활비 (${family})`} value={-h.monthlyExpense} />
            {game.housing.monthlyCost > 0 && (
              <Row label="주거비" value={-game.housing.monthlyCost} />
            )}
            {game.debt > 0 && (
              <tr>
                <th scope="row" className="border-b border-[#a6acb8] py-1 text-left font-normal">
                  빚 <span className="text-[12px] text-pen-soft">월 1.5% 이자</span>
                </th>
                <td className="border-b border-[#a6acb8] text-right text-red-pen">
                  {won(game.debt)}
                </td>
              </tr>
            )}
            <tr>
              <th
                scope="row"
                className="border-t-2 border-pen pt-1 text-left font-pen text-[22px] font-normal"
              >
                남은 돈
              </th>
              <td
                className={`border-t-2 border-pen pt-1 text-right font-pen text-[26px] ${saving < 0 ? 'text-red-pen' : ''}`}
                data-testid="monthly-saving"
              >
                {signedWon(saving)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-1 text-[13px] text-pen-soft" data-testid="family">
        가족 · {family}
        {h.marriedAge != null && ` (${h.marriedAge}살 결혼)`}
        {h.retired && ' · 은퇴'}
      </p>
    </section>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <th scope="row" className="border-b border-[#a6acb8] py-1 text-left font-normal">
        {label}
      </th>
      <td className={`border-b border-[#a6acb8] text-right ${value < 0 ? 'text-blue-pen' : ''}`}>
        {signedWon(value)}
      </td>
    </tr>
  )
}

function Stocks({ game }: { game: Game }) {
  const openMarket = useGameStore((s) => s.openMarket)
  const canTrade = game.phase === 'INVESTING' && game.status === 'ACTIVE'
  return (
    <section className="mt-6">
      <h2 className="font-pen text-[28px] font-normal leading-8">갖고 있는 주식</h2>
      {game.holdings.length === 0 ? (
        <p className="text-pen-soft">아직 없다.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {game.holdings.map((h) => (
            <li
              key={h.stockCode}
              className="flex justify-between gap-2 py-1"
              data-testid="holding-row"
              data-stock={h.stockCode}
            >
              <span>
                {h.stockName} {h.quantity.toLocaleString('ko-KR')}주
                <span className="ml-1 text-[12px] text-pen-soft">
                  평단 {h.avgCost.toLocaleString('ko-KR')}
                </span>
              </span>
              <span>
                {won(h.value)}{' '}
                <b className={h.pnlBp < 0 ? 'text-blue-pen' : 'text-red-pen'}>
                  {h.pnlBp < 0 ? '↓' : '↑'}
                  {percent(Math.abs(h.pnlBp))}
                </b>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mt-4 min-h-[52px] w-full rounded-full bg-pen text-[16px] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canTrade}
        onClick={openMarket}
        data-testid="open-market"
      >
        매매하러 가기 · 시간 정지
        {!canTrade && game.status === 'ACTIVE' && (
          <span className="ml-1 text-[13px]">(투자 시작 전)</span>
        )}
      </button>
    </section>
  )
}

const rate = (bp: number) => `${(bp / 100).toFixed(2)}%`

/** 집: 어떻게 사는지, 대출과 금리, 가진 아파트(매물로 내놓기), 아파트 시세 (주거 설계). */
function Home({ game }: { game: Game }) {
  const h = game.housing
  const listHome = useGameStore((s) => s.listHome)
  const busy = Boolean(game.pendingEvent) || game.status !== 'ACTIVE'
  return (
    <section className="mt-6" data-testid="housing-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">사는 곳</h2>
      <p data-testid="tenure">
        <b>{TENURE_LABELS[h.tenure]}</b>
        {h.regionName && h.tenure !== 'OWN' && ` · ${h.regionName}`}
        {h.leaseEndAge != null && ` · ${h.leaseEndAge}살 만기`}
        {h.insured && ' · 보증보험'}
      </p>
      {h.tenure !== 'PARENTS' && (
        <p className="text-[13px] text-pen-soft">
          {h.deposit > 0 && `보증금 ${won(h.deposit)} · `}
          {h.jeonseLoan > 0 && `전세대출 ${won(h.jeonseLoan)} · `}월 주거비 {won(h.monthlyCost)} ·
          주담대 금리 연 {rate(h.mortgageRateBp)}
        </p>
      )}
      {h.homes.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0" data-testid="homes">
          {h.homes.map((home) => {
            const gain = home.price - home.purchasePrice
            return (
              <li key={home.seq} className="border-b border-dashed border-[#a6acb8] pb-2">
                <p className="flex justify-between gap-2">
                  <span>
                    <b>{home.regionName}</b> {home.residence ? '내가 사는 집' : '갭투자'}
                  </span>
                  <span>{won(home.price)}</span>
                </p>
                <p className="text-[13px] text-pen-soft">
                  산 값 {won(home.purchasePrice)} ·{' '}
                  <span className={gain >= 0 ? 'text-red-pen' : 'text-blue-pen'}>
                    {signedWon(gain)}
                  </span>
                  {home.mortgage > 0 &&
                    ` · 주담대 ${won(home.mortgage)} (30년 원리금균등 · 월 ${won(home.monthlyPayment)})`}
                  {home.tenantDeposit > 0 && ` · 세입자 보증금 ${won(home.tenantDeposit)}`}
                </p>
                {home.mortgage > 0 && (
                  <MortgageRepay
                    seq={home.seq}
                    mortgage={home.mortgage}
                    cash={game.cash}
                    busy={busy}
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  className="mt-1 min-h-11 rounded-full border-2 border-pen px-4 text-[13px] hover:bg-white disabled:opacity-40"
                  onClick={() => void listHome(home.seq, !home.listed)}
                  data-testid={`list-home-${home.seq}`}
                >
                  {home.listed ? '매물 거두기 (매수자 기다리는 중)' : '매물로 내놓기'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {h.tenure !== 'PARENTS' && (
        <ul className="m-0 mt-2 list-none p-0 text-[13px] text-pen-soft" data-testid="home-quotes">
          {h.quotes.map((q) => (
            <li key={q.region} className="flex justify-between">
              <span>{q.name}</span>
              <span>
                {won(q.price)} · 1년{' '}
                <span className={q.change12mBp >= 0 ? 'text-red-pen' : 'text-blue-pen'}>
                  {signedPercent(q.change12mBp)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 주담대 일시 상환: 현금으로 원금을 갚아 남은 기간의 월 상환액을 줄인다 (decisions.md 58번). */
function MortgageRepay({
  seq,
  mortgage,
  cash,
  busy,
}: {
  seq: number
  mortgage: number
  cash: number
  busy: boolean
}) {
  const repayMortgage = useGameStore((s) => s.repayMortgage)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const max = Math.min(mortgage, Math.max(0, cash))
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const canSubmit = !busy && !sending && value >= 1 && value <= max
  const submit = async () => {
    setSending(true)
    const failed = await repayMortgage(seq, value)
    setSending(false)
    setError(failed)
    if (!failed) {
      setOpen(false)
      setAmount('')
    }
  }
  if (!open) {
    return (
      <button
        type="button"
        disabled={busy || max < 1}
        className="mt-1 mr-2 min-h-11 rounded-full border-2 border-pen px-4 text-[13px] hover:bg-white disabled:opacity-40"
        onClick={() => setOpen(true)}
        data-testid={`repay-home-${seq}`}
      >
        주담대 일시 상환
      </button>
    )
  }
  return (
    <div className="mt-1 rounded border border-line bg-card px-3 py-2.5" data-testid="repay-form">
      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted">갚을 원금</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          className="min-h-10 w-full rounded border border-line bg-card px-2.5 text-right font-mono-num text-base"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="갚을 원금"
        />
        <span className="text-xs text-muted">원</span>
      </label>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[10, 25, 50, 100].map((p) => (
          <button
            key={p}
            type="button"
            className="min-h-8 rounded border border-line bg-card font-mono-num text-[11px] hover:bg-bg"
            onClick={() => setAmount(String(Math.floor((max * p) / 100)))}
          >
            {p}%
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        현금 {won(cash)} · 남은 주담대 {won(mortgage)} · 최대 {won(max)}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-wine">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          className="min-h-11 flex-1 rounded bg-wine text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void submit()}
        >
          {sending ? '갚는 중…' : '갚기'}
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-line px-4 text-sm"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
