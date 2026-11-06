import { useEffect, useMemo, useRef, useState } from 'react'

/** 차트가 그려지는 시간(ms) (decisions.md 283·297번): 앞 2.3초는 요동, 뒤 0.9초는 쭈욱. */
export const CHART_MS = 3200

const W = 120
const H = 48
const POINTS = 44
/** 요동이 끝나고 한 번 멈칫하는 때(0~1), 쭈욱 뻗기 시작하는 때. */
const WOBBLE_END = 0.66
const RUN_START = 0.88
/** 끝점은 위든 아래든 가장자리까지 간다: 몇 %든 극단적으로 보인다. */
const EDGE = 2.5

/** 같은 종목·같은 결과면 늘 같은 모양: 문자열에서 시드를 만든다. */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 앱 게임 차트 (decisions.md 297번): 처음엔 가운데서 위아래로 크게 요동친다(반대쪽으로 속이는 뾰족한 가짜 신호 둘 포함). 잠깐 멈칫하다가 마지막에 결과 쪽으로
 * 쭈욱, 거의 수직으로 가장자리까지 간다. 몇 %든 끝은 극단이다.
 */
export function chartPoints(seed: number, up: boolean): [number, number][] {
  let s = seed || 1
  const rand = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1000) / 1000
  }
  const mid = H / 2
  const end = up ? EDGE : H - EDGE
  const against = up ? 1 : -1
  const freq = 2.6 + rand() * 1.2
  const phase = rand() * Math.PI * 2
  const fake1 = 0.22 + rand() * 0.14
  const fake2 = 0.46 + rand() * 0.12
  const points: [number, number][] = []
  let last = mid
  for (let i = 0; i < POINTS; i++) {
    const t = i / (POINTS - 1)
    let y: number
    if (t < WOBBLE_END) {
      // 요동: 진폭이 점점 커지는 파도에 잡음. 가짜 신호는 반대쪽으로 뾰족하게.
      const amp = 5 + 11 * (t / WOBBLE_END)
      const wave = Math.sin(t * Math.PI * 2 * freq + phase) * amp
      const noise = (rand() - 0.5) * 7
      const spike =
        Math.abs(t - fake1) < 0.03 || Math.abs(t - fake2) < 0.03 ? against * (8 + rand() * 6) : 0
      y = mid + wave + noise + spike
    } else if (t < RUN_START) {
      // 멈칫: 결과 반대쪽으로 살짝 기울며 숨을 고른다.
      const k = (t - WOBBLE_END) / (RUN_START - WOBBLE_END)
      y = last + (mid + against * 6 - last) * 0.35 * k + (rand() - 0.5) * 2
    } else {
      // 쭈욱: 가속하며 가장자리로.
      const k = (t - RUN_START) / (1 - RUN_START)
      y = last + (end - last) * k ** 2.4
    }
    y = Math.max(EDGE, Math.min(H - EDGE, y))
    points.push([(W * i) / (POINTS - 1), y])
    last = y
  }
  points[POINTS - 1] = [W, end]
  return points
}

/** 그려진 길이 비율 f(0~1)에서 지금 가격의 눈금: 가운데가 0, 가장자리가 ±1. */
export function tickerAt(points: [number, number][], f: number): number {
  const i = Math.min(points.length - 1, Math.max(0, Math.round(f * (points.length - 1))))
  return (H / 2 - points[i][1]) / (H / 2 - EDGE)
}

/** 시간 비율 t(0~1)를 그린 길이 비율로: 요동과 멈칫은 또박또박, 마지막 쭈욱은 두 배 가까이 빠르게 몰아친다. */
export function drawProgress(t: number): number {
  const knee = 0.92
  if (t < knee) {
    return (t / knee) * RUN_START
  }
  return RUN_START + ((t - knee) / (1 - knee)) * (1 - RUN_START)
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 종목 회의의 결정 장면 (decisions.md 283·297번). 고른 뒤 종목 차트가 앱 게임처럼 그려진다: 가운데서 위아래로 요동치며 가격 눈금이 빨강·파랑으로 깜빡이다가,
 * 멈칫한 뒤 결과 쪽으로 쭈욱 극단까지 뻗는다. 끝에 화면이 흔들리고 "급등!"·"급락!" 도장과 몇 %가 찍힌다. 결과(오르내림·몇 %)는 서버가 정한 그대로다.
 * 빨리 보기·움직임 줄이기면 다 그린 모습만.
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
    () => chartPoints(seedOf(`${stock}-${up}-${percent}`), up),
    [stock, up, percent],
  )
  const still = instant || reducedMotion()
  // 그린 길이 비율(0~1). 선·면·가격 눈금이 같이 움직인다.
  const [drawn, setDrawn] = useState(still ? 1 : 0)
  const [done, setDone] = useState(still)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (still) {
      setDrawn(1)
      setDone(true)
      return
    }
    setDrawn(0)
    setDone(false)
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / CHART_MS))
      setDrawn(drawProgress(t))
      if (t >= 1) {
        setDone(true)
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current)
      }
    }
  }, [still, delay])
  const shown = points.slice(0, Math.max(2, Math.round(drawn * (points.length - 1)) + 1))
  const line = shown.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [ex, ey] = shown[shown.length - 1]
  const area = `0,${H} ${line} ${ex.toFixed(1)},${H}`
  const tick = tickerAt(points, drawn)
  // 가격 눈금: 가운데 0에서 가장자리 ±percent. 요동 중엔 반대쪽도 찍힌다.
  const now = Math.round(tick * percent)
  const tone = done
    ? up
      ? 'text-up'
      : 'text-down'
    : now > 0
      ? 'text-up'
      : now < 0
        ? 'text-down'
        : 'text-muted'
  const running = !done && drawn >= RUN_START
  const color = up ? 'var(--up)' : 'var(--down)'
  return (
    <figure
      className={`mt-2 rounded border border-line bg-card p-2 ${done && !still ? 'animate-shake' : ''}`}
      data-testid="invest-chart"
      data-up={up}
      data-done={done}
      aria-label={`${stock} 차트가 ${percent}% ${up ? '올랐다' : '빠졌다'}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] text-muted">{stock} · 회의 뒤 주가</p>
        <p
          className={`font-mono-num text-[14px] font-bold tabular-nums transition-transform duration-150 ${tone} ${
            running ? 'scale-110' : ''
          }`}
          data-testid="chart-ticker"
          aria-hidden="true"
        >
          {now > 0 ? '+' : ''}
          {now}%
        </p>
      </div>
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
        <polygon points={area} fill={color} fillOpacity={done ? 0.18 : 0.1} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={running || done ? 1.8 : 1.3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={ex} cy={ey} r={done ? 2.4 : 1.6} fill={color}>
          {!still && (
            <animate attributeName="r" values="1.4;2.2;1.4" dur="0.5s" repeatCount="indefinite" />
          )}
        </circle>
      </svg>
      <div className="mt-1 flex items-baseline justify-end gap-2">
        {done && (
          <span
            className={`pen-circle font-pen text-[20px] leading-tight ${up ? 'text-up' : 'text-down'} ${
              still ? '' : 'animate-stamp'
            } px-2`}
            data-testid="chart-stamp"
          >
            {up ? '급등!' : '급락!'}
          </span>
        )}
        <p
          className={`font-mono-num text-[15px] font-bold ${up ? 'text-up' : 'text-down'} ${
            done ? '' : 'opacity-0'
          }`}
          data-testid="chart-change"
        >
          {up ? '▲ +' : '▼ −'}
          {percent}%
        </p>
      </div>
    </figure>
  )
}
