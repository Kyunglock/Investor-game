import type { Game } from '../../api/client'
import { Card } from './Card'
import { won } from './labels'
import { changeBp, signedPercent } from './market'
import { useGameStore } from './store'

/** 총자산·현금·투자·빚과 보유 종목 (경제 개편 설계 11.1절). 숫자는 매달 서버 값으로 바뀐다. */
export function PortfolioCard({ game }: { game: Game }) {
  const openMarket = useGameStore((s) => s.openMarket)
  const monthDelta =
    game.lastMonthTotalAsset == null ? null : game.totalAsset - game.lastMonthTotalAsset
  const canTrade = game.phase === 'INVESTING' && game.status === 'ACTIVE'
  const monthLabel = `${Math.floor(game.market.month % 12) + 1}월`

  return (
    <Card title="포트폴리오" aside={`${monthLabel} 기준`} testId="portfolio-card">
      {/* 320px 카드에 억 단위 금액 4개를 한 줄로 놓으면 겹쳐서 2×2로 둔다 */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-faint">
        <div>
          총자산
          <b
            className="mt-0.5 block font-mono-num text-[15px] font-semibold text-ink"
            data-testid="total-asset"
          >
            {won(game.totalAsset)}
          </b>
        </div>
        <div>
          현금
          <b
            className="mt-0.5 block font-mono-num text-sm font-semibold text-ink"
            data-testid="cash"
          >
            {won(game.cash)}
          </b>
        </div>
        <div>
          투자
          <b
            className="mt-0.5 block font-mono-num text-sm font-semibold text-ink"
            data-testid="invested"
          >
            {won(game.invested)}
          </b>
        </div>
        <div>
          빚
          <b
            className={`mt-0.5 block font-mono-num text-sm font-semibold ${game.debt > 0 ? 'text-up' : 'text-faint'}`}
            data-testid="debt"
          >
            {won(game.debt)}
          </b>
        </div>
      </div>
      {monthDelta !== null && game.lastMonthTotalAsset != null && (
        <p className="mt-2 rounded bg-bg px-2 py-1.5 text-xs" data-testid="month-delta">
          이번 달{' '}
          <b
            className={`font-mono-num ${monthDelta > 0 ? 'text-up' : monthDelta < 0 ? 'text-down' : ''}`}
          >
            {monthDelta >= 0 ? '+' : ''}
            {won(monthDelta)} ({signedPercent(changeBp(game.totalAsset, game.lastMonthTotalAsset))})
          </b>
          <span className="text-faint"> · 전월 말 대비</span>
        </p>
      )}

      {game.holdings.length === 0 ? (
        <p className="mt-3 text-xs text-faint">아직 보유 종목이 없다</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="text-[10px] font-normal text-faint">
              <th className="border-b border-line pb-1 text-left font-normal">종목</th>
              <th className="border-b border-line pb-1 text-right font-normal">수량</th>
              <th className="border-b border-line pb-1 text-right font-normal">평단</th>
              <th className="border-b border-line pb-1 text-right font-normal">현재가</th>
              <th className="border-b border-line pb-1 text-right font-normal">수익률</th>
              <th className="border-b border-line pb-1 text-right font-normal">평가액</th>
            </tr>
          </thead>
          <tbody>
            {game.holdings.map((h) => (
              <tr key={h.stockCode} data-testid="holding-row" data-stock={h.stockCode}>
                <td className="border-b border-line-soft py-1.5">
                  {h.stockName}
                  <span className="block text-[10px] text-faint">{h.sectorName}</span>
                </td>
                <td className="border-b border-line-soft py-1.5 text-right font-mono-num">
                  {h.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="border-b border-line-soft py-1.5 text-right font-mono-num">
                  {h.avgCost.toLocaleString('ko-KR')}
                </td>
                <td className="border-b border-line-soft py-1.5 text-right font-mono-num">
                  {h.price.toLocaleString('ko-KR')}
                </td>
                <td
                  className={`border-b border-line-soft py-1.5 text-right font-mono-num ${h.pnlBp > 0 ? 'text-up' : h.pnlBp < 0 ? 'text-down' : ''}`}
                >
                  {signedPercent(h.pnlBp)}
                </td>
                <td className="border-b border-line-soft py-1.5 text-right font-mono-num">
                  {h.value.toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        className="mt-3 min-h-11 w-full rounded bg-wine text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canTrade}
        onClick={openMarket}
        data-testid="open-market"
      >
        매매
        {!canTrade && game.status === 'ACTIVE' && (
          <span className="ml-1 text-[11px] font-normal">· 투자 시작 전</span>
        )}
      </button>
    </Card>
  )
}
