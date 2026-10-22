import type { StockHistory } from '../../api/client'
import { type MarkerKind, movingAverage } from './analysis'

const W = 300
const H = 130
const LEFT = 40
const RIGHT = 8
const TOP = 8
const BOTTOM = 110
const JOB_AGE = 24
const MONTHS_PER_YEAR = 12
const SHORT_MA = 6
const LONG_MA = 12

export interface ChartMarker {
  month: number
  kind: MarkerKind
}

const MARKER_COLOR: Record<ChartMarker['kind'], string> = {
  NEWS: 'var(--gold)',
  SHAKE: 'var(--wine)',
  TRADE: 'var(--ink)',
}

/**
 * 한 종목의 월간 전체 차트. x축은 나이, y축은 원. 가격 위에 6·12개월 이동평균선을 겹치고, 그 종목의 뉴스·흔들림·내 매매가 있던 달을 점으로 찍는다
 * (매매창 설계 2.1절). 데이터는 서버의 이력만 쓴다.
 */
export function PriceChart({
  history,
  startAge,
  currentAge,
  markers = [],
}: {
  history: StockHistory | undefined
  startAge: number
  currentAge: number
  markers?: ChartMarker[]
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
  const line = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(points[i].month).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ')
  const path = line(prices)
  const ma6 = movingAverage(prices, SHORT_MA)
  const ma12 = movingAverage(prices, LONG_MA)
  const last = points[points.length - 1]
  const ageTicks = [startAge, JOB_AGE, currentAge].filter(
    (age, i, all) => all.indexOf(age) === i && age >= startAge && age <= currentAge,
  )
  const monthOf = (age: number) => (age - startAge) * MONTHS_PER_YEAR
  const priceAt = new Map(points.map((p) => [p.month, p.price]))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full font-mono-num text-[8px]"
      style={{ fill: 'var(--faint)' }}
      role="img"
      aria-label="월별 가격과 이동평균"
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
      {points.length >= 2 && (
        <>
          <path
            d={line(ma12)}
            fill="none"
            stroke="var(--down)"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <path d={line(ma6)} fill="none" stroke="var(--gold)" strokeWidth={1} />
        </>
      )}
      <path d={path} fill="none" stroke="var(--teal)" strokeWidth={2} />
      {markers.map((m, i) => {
        const price = priceAt.get(m.month)
        if (price === undefined) {
          return null
        }
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 달에 같은 종류가 여럿일 수 있다
            key={`${m.kind}-${m.month}-${i}`}
            cx={x(m.month)}
            cy={y(price)}
            r={2.4}
            fill={MARKER_COLOR[m.kind]}
            stroke="var(--card)"
            strokeWidth={0.8}
          />
        )
      })}
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
