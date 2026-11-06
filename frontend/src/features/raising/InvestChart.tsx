import { useEffect, useMemo, useRef, useState } from 'react'

/** 차트가 그려지는 시간(ms) (decisions.md 283·297·299번): 앞 2.6초는 요동, 뒤 1초는 쭈욱. */
export const CHART_MS = 3600

const W = 120
const H = 48
const POINTS = 120
/** 요동이 끝나고 한 번 멈칫하는 때(0~1), 쭈욱 뻗기 시작하는 때. */
const WOBBLE_END = 0.74
const RUN_START = 0.86
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
 * 앱 게임 차트 (decisions.md 297·299번): 급등주처럼 가운데를 위아래로 자주 넘나들며 크게 요동친다. 큰 파도에 잔파도가 겹치고, 뾰족한 가짜 신호가 양쪽으로
 * 여럿 튄다. 잠깐 멈칫하다가 마지막에 결과 쪽으로 쭈욱, 거의 수직으로 가장자리까지 간다. 몇 %든 끝은 극단이다.
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
  const freq = 3.4 + rand() * 1.4
  const phase = rand() * Math.PI * 2
  const freq2 = 9 + rand() * 4
  const phase2 = rand() * Math.PI * 2
  // 가짜 신호: 양쪽으로 넷, 반대쪽이 조금 더 세다.
  const spikes = Array.from({ length: 4 }, (_, i) => ({
    at: 0.1 + i * 0.16 + rand() * 0.1,
    dir: i % 2 === 0 ? against : -against,
    size: 7 + rand() * 7,
  }))
  const points: [number, number][] = []
  let last = mid
  // 시작은 가운데(0%)에서: 첫 자리의 파도 높이만큼 빼고, 그 보정은 금방 사라진다.
  const ampAt = (k: number) => 5 + 13 * k
  const rippleAt = (k: number) => 2 + 3 * k
  const start = Math.sin(phase) * ampAt(0) + Math.sin(phase2) * rippleAt(0)
  for (let i = 0; i < POINTS; i++) {
    const t = i / (POINTS - 1)
    let y: number
    if (t < WOBBLE_END) {
      const k = t / WOBBLE_END
      // 큰 파도(진폭이 커진다) + 잔파도 + 잡음. 가운데를 자주 넘나든다.
      const wave = Math.sin(t * Math.PI * 2 * freq + phase) * ampAt(k)
      const ripple = Math.sin(t * Math.PI * 2 * freq2 + phase2) * rippleAt(k)
      const settle = start * (1 - k) ** 3
      const noise = (rand() - 0.5) * 3
      let spike = 0
      for (const sp of spikes) {
        const d = Math.abs(t - sp.at)
        if (d < 0.025) {
          spike += sp.dir * sp.size * (1 - d / 0.025)
        }
      }
      y = mid + wave + ripple - settle + noise + spike
    } else if (t < RUN_START) {
      // 멈칫: 결과 반대쪽으로 살짝 기울며 숨을 고른다. 잔파도는 남는다.
      const k = (t - WOBBLE_END) / (RUN_START - WOBBLE_END)
      const ripple = Math.sin(t * Math.PI * 2 * freq2 + phase2) * 1.5
      y = last + (mid + against * 5 - last) * 0.3 * k + ripple * 0.3
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

/** 그린 길이 비율 f(0~1)에서의 자리: 점 사이를 잇는다(부드럽게). */
export function pointAt(points: [number, number][], f: number): [number, number] {
  const pos = Math.min(points.length - 1, Math.max(0, f * (points.length - 1)))
  const i = Math.floor(pos)
  const j = Math.min(points.length - 1, i + 1)
  const r = pos - i
  return [
    points[i][0] + (points[j][0] - points[i][0]) * r,
    points[i][1] + (points[j][1] - points[i][1]) * r,
  ]
}

/**
 * 점들을 부드러운 곡선(캣멀롬 → 3차 베지에)으로 잇는 path. 마지막 점은 f에서 끊은 자리라 끝이 떨리지 않고 흐른다.
 */
export function smoothPath(points: [number, number][]): string {
  if (points.length < 2) {
    return ''
  }
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = p(i - 1)
    const [x1, y1] = p(i)
    const [x2, y2] = p(i + 1)
    const [x3, y3] = p(i + 2)
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`
  }
  return d
}

/** 그려진 길이 비율 f(0~1)에서 지금 가격의 눈금: 가운데가 0, 가장자리가 ±1. */
export function tickerAt(points: [number, number][], f: number): number {
  return (H / 2 - pointAt(points, f)[1]) / (H / 2 - EDGE)
}

/** 시간 비율 t(0~1)를 그린 길이 비율로: 요동과 멈칫은 또박또박, 마지막 쭈욱은 두 배 가까이 빠르게 몰아친다. */
export function drawProgress(t: number): number {
  const knee = 0.9
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
  // 그린 길이까지의 점에 끊은 자리의 점을 붙여 부드러운 곡선으로 잇는다: 프레임마다 점 하나씩 튀지 않고 흐른다.
  const upto = Math.floor(drawn * (points.length - 1))
  const [ex, ey] = pointAt(points, drawn)
  const shown: [number, number][] = [...points.slice(0, upto + 1), [ex, ey]]
  const line = smoothPath(shown)
  const area = `${line} L${ex.toFixed(2)},${H} L0,${H} Z`
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
        <path d={area} fill={color} fillOpacity={done ? 0.18 : 0.1} />
        <path
          d={line}
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
