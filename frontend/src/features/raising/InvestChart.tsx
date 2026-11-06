import { useMemo } from 'react'

/** 차트가 그려지는 시간(ms) (decisions.md 283번). */
export const CHART_MS = 2600

const W = 120
const H = 48
const POINTS = 28

/** 같은 종목·같은 결과면 늘 같은 모양: 문자열에서 시드를 만든다. */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 결과 쪽(오름·내림)으로 가는 흔들리는 길. 처음엔 가운데서 엎치락뒤치락하다 끝에 가서 크게 기운다. */
export function chartPoints(seed: number, up: boolean, percent: number): [number, number][] {
  let s = seed || 1
  const rand = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1000) / 1000
  }
  const start = H / 2
  const swing = Math.min(H / 2 - 4, 6 + percent * 0.45)
  const end = up ? start - swing : start + swing
  const points: [number, number][] = []
  for (let i = 0; i < POINTS; i++) {
    const t = i / (POINTS - 1)
    // 앞 절반은 반대쪽으로도 흔들리고, 뒤로 갈수록 결과 쪽으로 쏠린다.
    const pull = t ** 2.2
    const noise = (rand() - 0.5) * (10 - 6 * t)
    const y = start + (end - start) * pull + noise
    points.push([(W * i) / (POINTS - 1), Math.max(3, Math.min(H - 3, y))])
  }
  points[POINTS - 1] = [W, end]
  return points
}

/**
 * 종목 회의의 결정 장면 (decisions.md 283번). 직원마다 돌던 맞대결 막대 대신, 고른 뒤 종목 차트가 그려지며 오르거나 빠진다. 결과(오르내림·몇 %)는 서버가
 * 정한 그대로다. 빨리 보기·움직임 줄이기면 다 그린 모습만.
 */
export function InvestChart({
  stock,
  up,
  percent,
  delay,
  instant,
}: {
  stock: string
  up: boolean
  percent: number
  delay: number
  instant: boolean
}) {
  const points = useMemo(
    () => chartPoints(seedOf(`${stock}-${up}-${percent}`), up, percent),
    [stock, up, percent],
  )
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const color = up ? 'var(--up)' : 'var(--down)'
  const [ex, ey] = points[points.length - 1]
  const draw = instant
    ? undefined
    : { animationDelay: `${delay}ms`, animationDuration: `${CHART_MS}ms` }
  const after = instant ? undefined : { animationDelay: `${delay + CHART_MS}ms` }
  return (
    <figure
      className="mt-2 rounded border border-line bg-card p-2"
      data-testid="invest-chart"
      data-up={up}
      aria-label={`${stock} 차트가 ${percent}% ${up ? '올랐다' : '빠졌다'}`}
    >
      <p className="text-[12px] text-muted">{stock} · 회의 뒤 주가</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block h-auto w-full"
        role="img"
        aria-hidden="true"
      >
        {[H / 4, H / 2, (H * 3) / 4].map((y) => (
          <line key={y} x1={0} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth={0.3} />
        ))}
        <line
          x1={0}
          x2={W}
          y1={H / 2}
          y2={H / 2}
          stroke="var(--muted)"
          strokeWidth={0.4}
          strokeDasharray="1.5 1.5"
        />
        <polygon
          points={area}
          fill={color}
          fillOpacity={0.12}
          className={instant ? '' : 'animate-reveal'}
          style={after}
        />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={instant ? 0 : undefined}
          className={instant ? '' : 'chart-draw'}
          style={draw}
        />
        <circle
          cx={ex}
          cy={ey}
          r={2}
          fill={color}
          className={instant ? '' : 'animate-reveal'}
          style={after}
        />
      </svg>
      <p
        className={`mt-1 text-right font-mono-num text-[15px] font-bold ${up ? 'text-up' : 'text-down'} ${instant ? '' : 'animate-stamp'}`}
        style={after}
        data-testid="chart-change"
      >
        {up ? '▲ +' : '▼ −'}
        {percent}%
      </p>
    </figure>
  )
}
