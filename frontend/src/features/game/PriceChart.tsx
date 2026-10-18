import type { StockHistory } from '../../api/client'

const W = 300
const H = 130
const LEFT = 40
const RIGHT = 8
const TOP = 8
const BOTTOM = 110
const JOB_AGE = 24
const MONTHS_PER_YEAR = 12

/** 한 종목의 월간 전체 차트. x축은 나이, y축은 원. 데이터는 서버의 이력만 쓴다 (경제 개편 설계 11.2절). */
export function PriceChart({
  history,
  startAge,
  currentAge,
}: {
  history: StockHistory | undefined
  startAge: number
  currentAge: number
}) {
  const points = history?.points ?? []
  if (points.length === 0) {
    return <p className="py-10 text-center text-xs text-faint">이력을 불러오는 중…</p>
  }
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const lastMonth = points[points.length - 1].month
  const x = (month: number) => LEFT + (month / Math.max(lastMonth, 1)) * (W - LEFT - RIGHT)
  const y = (price: number) => BOTTOM - ((price - min) / span) * (BOTTOM - TOP)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)} ${y(p.price).toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]
  const ageTicks = [startAge, JOB_AGE, currentAge].filter(
    (age, i, all) => all.indexOf(age) === i && age >= startAge && age <= currentAge,
  )
  const monthOf = (age: number) => (age - startAge) * MONTHS_PER_YEAR

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full font-mono-num text-[8px]"
      style={{ fill: 'var(--faint)' }}
      role="img"
      aria-label="월별 가격"
    >
      <line x1={LEFT} y1={BOTTOM} x2={W - RIGHT} y2={BOTTOM} stroke="var(--line)" />
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={BOTTOM} stroke="var(--line)" />
      <text x={2} y={BOTTOM + 2}>
        {compact(min)}
      </text>
      <text x={2} y={TOP + 6}>
        {compact(max)}
      </text>
      {ageTicks.map((age) => (
        <text key={age} x={x(Math.min(monthOf(age), lastMonth)) - 6} y={H - 6}>
          {age}세
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--teal)" strokeWidth={2} />
      <circle cx={x(last.month)} cy={y(last.price)} r={3} fill="var(--wine)" />
    </svg>
  )
}

/** 축 눈금용 짧은 금액. 만원 단위로 줄인다. */
function compact(won: number): string {
  if (won >= 100_000_000) {
    return `${(won / 100_000_000).toFixed(1)}억`
  }
  if (won >= 10_000) {
    return `${Math.round(won / 10_000).toLocaleString('ko-KR')}만`
  }
  return won.toLocaleString('ko-KR')
}
