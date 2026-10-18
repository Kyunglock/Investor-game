import type { Game } from '../../api/client'
import { Card } from './Card'
import { won } from './labels'

/** 보유 종목. 하나도 없으면 카드를 그리지 않는다. */
export function HoldingsCard({ game }: { game: Game }) {
  if (game.holdings.length === 0) {
    return null
  }
  return (
    <Card title="보유 종목">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {game.holdings.map((h) => (
            <tr key={h.sectorCode}>
              <td className="border-b border-line-soft py-1.5">{h.sectorName}</td>
              <td className="border-b border-line-soft py-1.5 text-right font-mono-num">
                {won(h.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-1.5 text-muted">현금</td>
            <td className="py-1.5 text-right font-mono-num text-muted">{won(game.cash)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  )
}
