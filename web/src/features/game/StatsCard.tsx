import type { Game } from '../../api/client'
import { Card } from './Card'
import { STAT_KEYS, STAT_LABELS } from './labels'
import { nickname } from './nickname'

/** 능력치 막대와 자산. 강점은 와인색, 약점은 금색, 나머지는 청록 (설계 4.1절). */
export function StatsCard({ game }: { game: Game }) {
  const strength = nickname(game.initialStats).strength
  const current = nickname(game.stats)

  return (
    <Card title="능력치" aside="0–100">
      <ul className="flex flex-col gap-1.5">
        {STAT_KEYS.map((key) => {
          const color =
            key === strength ? 'bg-wine' : key === current.weakness ? 'bg-gold' : 'bg-teal'
          return (
            <li
              key={key}
              className="grid grid-cols-[44px_1fr_30px] items-center gap-2 text-xs"
              data-testid={`stat-${key}`}
            >
              <span>{STAT_LABELS[key]}</span>
              <span className="h-2 overflow-hidden rounded-sm bg-line-soft">
                <span
                  className={`block h-full transition-[width] duration-500 ${color}`}
                  style={{ width: `${game.stats[key]}%` }}
                />
              </span>
              <span className="text-right font-mono-num">{game.stats[key]}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs font-bold text-wine">
        약점: {STAT_LABELS[current.weakness]} — {current.weaknessEffect}
      </p>
    </Card>
  )
}
