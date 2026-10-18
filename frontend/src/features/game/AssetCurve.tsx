import type { Game } from '../../api/client'
import { Card } from './Card'
import { curvePoints } from './timeline'

const W = 260
const H = 110
const LEFT = 36
const BOTTOM = 90
const TOP = 10
const JOB_AGE = 24
const MAN_WON = 10_000

/** 총자산 곡선, 만원 단위 (설계 5.2절). full이면 결과 화면용으로 끝까지 그린다. */
export function AssetCurve({
  game,
  ageYears,
  full = false,
}: {
  game: Game
  ageYears: number
  full?: boolean
}) {
  const age = full ? game.endAge : ageYears
  const points = curvePoints(game.yearly, game.initialAsset, game.startAge, age)
  const max = Math.max(...points.map((p) => p.totalAsset), 1)
  const x = (a: number) =>
    LEFT + ((a - game.startAge) / (game.endAge - game.startAge)) * (W - LEFT - 8)
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.age).toFixed(1)} ${y(p.totalAsset).toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]
  // 눈금이 겹치지 않게 현재 나이는 다른 눈금과 3년 이상 떨어졌을 때만 적는다.
  const fixed = [game.startAge, JOB_AGE, game.endAge]
  const ticks = fixed.every((t) => Math.abs(t - age) >= 3) ? [...fixed, age] : fixed
  const manWon = (v: number) => Math.round(v / MAN_WON).toLocaleString('ko-KR')

  return (
    <Card title="자산 곡선" aside="총자산, 만원" testId="asset-curve">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full font-mono-num text-[8px]"
        style={{ fill: 'var(--faint)' }}
        role="img"
        aria-label="나이에 따른 총자산"
      >
        <line x1={LEFT} y1={BOTTOM} x2={W - 8} y2={BOTTOM} stroke="var(--line)" />
        <line x1={LEFT} y1={TOP} x2={LEFT} y2={BOTTOM} stroke="var(--line)" />
        <text x={2} y={BOTTOM + 2}>
          0
        </text>
        <text x={2} y={TOP + 4}>
          {manWon(max)}
        </text>
        {ticks.map((t) => (
          <text key={t} x={x(t) - 3} y={H - 6}>
            {t}
          </text>
        ))}
        <path d={path} fill="none" stroke="var(--teal)" strokeWidth={2} />
        <circle cx={x(last.age)} cy={y(last.totalAsset)} r={3} fill="var(--wine)" />
      </svg>
    </Card>
  )
}
