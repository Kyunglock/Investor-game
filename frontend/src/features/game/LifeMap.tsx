import type { Game } from '../../api/client'
import { Card } from './Card'
import { type YearFill, yearFills } from './timeline'

const FILL_CLASS: Record<YearFill, string> = {
  empty: 'bg-line-soft',
  up: 'bg-teal',
  flat: 'bg-[#7fb3a5]',
  current: 'bg-card outline outline-2 -outline-offset-2 outline-wine',
  end: 'bg-card outline outline-2 -outline-offset-2 outline-faint',
}

/** 한 칸 = 1년, 시작 나이(15세)부터 70세까지 56칸 = 14 × 4 (설계 5.2절, decisions.md 27번). */
export function LifeMap({ game, ageYears }: { game: Game; ageYears: number }) {
  const cells = yearFills(game.yearly, game.initialAsset, ageYears, game.startAge, game.endAge).map(
    (fill, i) => ({ age: game.startAge + i, fill }),
  )

  return (
    <Card title="인생 지도" aside="한 칸 = 1년" testId="life-map">
      <div className="grid grid-cols-14 gap-[3px]">
        {cells.map((cell) => (
          <span
            key={cell.age}
            title={`${cell.age}세`}
            className={`aspect-square rounded-[1px] transition-colors duration-500 ${FILL_CLASS[cell.fill]}`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        한 칸 = 1년 · 진할수록 자산이 늘었던 해
        <br />
        테두리 칸 = {game.endAge}세 종료
      </p>
    </Card>
  )
}
