import type { Game } from '../../api/client'
import { Card } from './Card'
import { won } from './labels'
import { signedPercent } from './market'
import { useGameStore } from './store'

/** 거주 형태 이름 (주거 설계 1절). */
export const TENURE_LABELS: Record<Game['housing']['tenure'], string> = {
  PARENTS: '부모님 집',
  MONTHLY: '월세',
  VILLA_JEONSE: '빌라 전세',
  APT_JEONSE: '아파트 전세',
  OWN: '자가',
}

const rate = (bp: number) => `${(bp / 100).toFixed(2)}%`

/** 집: 어떻게 사는지, 대출과 금리, 가진 아파트(매물로 내놓기), 아파트 시세 (주거 설계). */
export function HousingCard({ game }: { game: Game }) {
  const h = game.housing
  const listHome = useGameStore((s) => s.listHome)
  const busy = Boolean(game.pendingEvent) || game.status !== 'ACTIVE'
  return (
    <Card title="집" aside={`주담대 연 ${rate(h.mortgageRateBp)}`} testId="housing-card">
      <p className="text-sm" data-testid="tenure">
        <b>{TENURE_LABELS[h.tenure]}</b>
        {h.regionName && h.tenure !== 'OWN' && (
          <span className="text-faint"> · {h.regionName}</span>
        )}
        {h.leaseEndAge != null && <span className="text-faint"> · {h.leaseEndAge}세 만기</span>}
        {h.insured && <span className="text-teal"> · 보증보험</span>}
      </p>
      {h.tenure !== 'PARENTS' && (
        <dl className="mt-1.5 grid grid-cols-[72px_1fr] gap-x-1.5 gap-y-0.5 text-xs">
          {h.deposit > 0 && (
            <>
              <dt className="text-faint">보증금</dt>
              <dd className="font-mono-num">{won(h.deposit)}</dd>
            </>
          )}
          {h.jeonseLoan > 0 && (
            <>
              <dt className="text-faint">전세대출</dt>
              <dd className="font-mono-num text-up">{won(h.jeonseLoan)}</dd>
            </>
          )}
          <dt className="text-faint">월 주거비</dt>
          <dd className="font-mono-num">{won(h.monthlyCost)}</dd>
        </dl>
      )}

      {h.homes.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5" data-testid="homes">
          {h.homes.map((home) => {
            const gain = home.price - home.purchasePrice
            return (
              <li key={home.seq} className="rounded border border-line-soft px-2.5 py-1.5 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    <b>{home.regionName}</b>{' '}
                    <span className="text-faint">{home.residence ? '내가 사는 집' : '갭투자'}</span>
                  </span>
                  <span className="font-mono-num font-semibold">{won(home.price)}</span>
                </div>
                <p className="mt-0.5 font-mono-num text-[11px] text-faint">
                  산 값 {won(home.purchasePrice)} ·{' '}
                  <span className={gain >= 0 ? 'text-up' : 'text-down'}>
                    {gain >= 0 ? '+' : ''}
                    {won(gain)}
                  </span>
                  {home.mortgage > 0 &&
                    ` · 주담대 ${won(home.mortgage)} (월 ${won(home.monthlyPayment)})`}
                  {home.tenantDeposit > 0 && ` · 세입자 보증금 ${won(home.tenantDeposit)}`}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="mt-1 min-h-8 rounded border border-line px-2 text-[11px] font-bold hover:bg-bg disabled:opacity-40"
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
        <ul
          className="mt-2.5 flex flex-col gap-0.5 text-[11px] text-faint"
          data-testid="home-quotes"
        >
          {h.quotes.map((q) => (
            <li key={q.region} className="flex justify-between">
              <span>{q.name}</span>
              <span className="font-mono-num">
                {won(q.price)} ·{' '}
                <span className={q.change12mBp >= 0 ? 'text-up' : 'text-down'}>
                  12개월 {signedPercent(q.change12mBp)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
