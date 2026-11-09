import type { Company, Grade } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { LADDER } from '@web/features/raising/grades'
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { CatFigure } from './CatFigure'
import {
  expansionSide,
  MOVE_DONE,
  type MovePhase,
  moveTimeline,
  officeGeometry,
  rivalName,
} from './model'

export type OfficeTransition = { before: Grade; after: Grade; beforeSeats: number }

function Rival({
  x,
  height,
  width,
  name,
  hit,
  fly = 0,
}: {
  x: number
  height: number
  width: number
  name: string
  hit?: 'left' | 'right'
  /** 밀려날 때 날아가는 거리(세계 좌표). 카메라가 물러나도 화면에서 같은 만큼 날아가게 축척으로 나눠 받는다. */
  fly?: number
}) {
  return (
    <g
      className={hit ? 'toy-rival toy-evict' : 'toy-rival'}
      style={
        {
          transformOrigin: `${x + width / 2}px 560px`,
          '--toy-fly': `${fly}px`,
          '--toy-lift': `${-Math.abs(fly) * 0.22}px`,
          '--toy-spin': `${Math.sign(fly) * 75}deg`,
        } as CSSProperties
      }
      data-hit={hit}
    >
      <path d={`M${x} ${560 - height}l9-7h${width}v${height}l-9 7`} fill="#8fa5c8" />
      <rect x={x} y={560 - height} width={width} height={height} rx="5" fill="#b9c7e2" />
      {/* 밀려날 때 간판은 떨어지는 조각(Eviction)이 따로 그린다. */}
      {!hit && <RivalSign x={x} width={width} height={height} name={name} />}
      {Array.from({ length: Math.floor((height - 60) / 36) }, (_, r) =>
        Array.from({ length: Math.max(3, Math.floor(width / 32)) }, (_, col) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 건물 창문 좌표다.
            key={`${r}-${col}`}
            x={x + 10 + col * ((width - 20) / Math.max(3, Math.floor(width / 32)))}
            y={602 - height + r * 36}
            width={(width - 20) / Math.max(3, Math.floor(width / 32)) - 8}
            height="22"
            rx="3"
            fill={(r + col) % 3 ? '#97b5c9' : '#ffdc8f'}
          />
        )),
      )}
      <rect x={x + width / 2 - 11} y="537" width="22" height="23" fill="#829bc4" />
    </g>
  )
}

function RivalSign({
  x,
  width,
  height,
  name,
}: {
  x: number
  width: number
  height: number
  name: string
}) {
  return (
    <>
      <rect x={x + 4} y={568 - height} width={width - 8} height="24" rx="3" fill="#829bc4" />
      <text
        x={x + width / 2}
        y={584 - height}
        textAnchor="middle"
        fontSize="10"
        fill="#fff"
        fontWeight="700"
      >
        {name}
      </text>
    </>
  )
}

/** 조각이 날아갈 방향·거리·회전 (화면 기준 px·deg). 매번 같은 모양이 나오게 고정해 둔다. */
const BRICKS = [
  [62, -96, 260],
  [118, -58, -320],
  [150, -20, 410],
  [86, -132, -200],
  [-46, -84, 300],
  [-92, -40, -260],
  [34, -150, 520],
  [132, -110, -440],
]
const SHARDS = [
  [70, -80, 300],
  [130, -40, -380],
  [40, -120, 460],
  [-30, -70, -260],
  [100, -140, 220],
  [160, -90, -500],
]
const DUST = [-58, -30, -6, 18, 44, 70]
const SPARKS = Array.from({ length: 10 }, (_, i) => i * 36 + (i % 2) * 14)
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180
  const d = (6 * Math.PI) / 180
  const r = 330
  const p = (t: number) => `${(Math.cos(t) * r).toFixed(1)} ${(Math.sin(t) * r).toFixed(1)}`
  return `M0 0L${p(a - d)}L${p(a + d)}Z`
}).join('')
const STAR = 'M0-12L3-3 12 0 3 3 0 12-3 3-12 0-3-3Z'
const BOOM = Array.from({ length: 24 }, (_, i) => {
  const a = (i * 15 * Math.PI) / 180
  const r = i % 2 ? 26 : 50 + (i % 4) * 4
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`
}).join(' ')

function flyStyle(dx: number, dy: number, r: number, delay = 0) {
  return {
    '--dx': `${dx}px`,
    '--dy': `${dy}px`,
    '--r': `${r}deg`,
    animationDelay: `${delay}s`,
  } as CSSProperties
}

/** 부딪힌 자리 (phase 1~2): 충격파 고리·불꽃·벽돌 파편·먼지구름과 "쾅!". 카메라 축척을 되돌려 화면에서 늘 같은 크기로 보인다. */
function Impact({
  x,
  y,
  ground,
  k,
  dir,
}: {
  x: number
  y: number
  ground: number
  k: number
  dir: number
}) {
  return (
    <g data-testid="toy-impact" pointerEvents="none">
      <g transform={`translate(${x} ${ground}) scale(${k})`}>
        {DUST.map((dx, i) => (
          <g key={dx} transform={`translate(${dx} ${-8 - (i % 3) * 6})`}>
            <circle
              className="toy-dust"
              r={16 + (i % 3) * 5}
              fill={i % 2 ? '#efe4cf' : '#ddd0b8'}
              style={flyStyle(dx * 0.9, -20 - (i % 2) * 14, 0, 0.08 + (i % 3) * 0.04)}
            />
          </g>
        ))}
      </g>
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        <circle className="toy-ring" r="22" fill="none" stroke="#fff" strokeWidth="7" />
        <circle
          className="toy-ring"
          r="22"
          fill="none"
          stroke="#ffd36b"
          strokeWidth="5"
          style={{ animationDelay: '0.2s' }}
        />
        {SPARKS.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect className="toy-spark" x="8" y="-2" width="20" height="4" rx="2" fill="#ffcf4a" />
          </g>
        ))}
        {BRICKS.map(([dx, dy, r], i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 파편 목록이다.
            key={i}
            className="toy-debris"
            x="-6"
            y="-4"
            width={i % 3 ? 12 : 9}
            height={i % 3 ? 7 : 9}
            rx="1.5"
            fill={['#c96f4a', '#b9c7e2', '#829bc4', '#e3a06b'][i % 4]}
            style={flyStyle(dx * dir, dy, r, 0.1)}
          />
        ))}
        <g className="toy-kaboom" transform="translate(0 -62) rotate(-8)">
          <polygon points={BOOM} fill="#ffe066" stroke="#f08a4b" strokeWidth="4" />
          <text
            y="13"
            textAnchor="middle"
            fontSize="38"
            fill="#fff"
            stroke="#c4492f"
            strokeWidth="6"
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            쾅!
          </text>
        </g>
      </g>
    </g>
  )
}

/** 밀려나는 건물 (phase 2): 간판이 떨어지고 창문 조각이 튄다. */
function Eviction({
  x,
  width,
  height,
  name,
  k,
  dir,
}: {
  x: number
  width: number
  height: number
  name: string
  k: number
  dir: number
}) {
  return (
    <g pointerEvents="none" data-testid="toy-eviction">
      <g
        className="toy-sign-fall"
        style={
          {
            transformOrigin: `${x + width / 2}px ${580 - height}px`,
            '--toy-drop': `${height - 34}px`,
            '--toy-tilt': `${dir * 32}deg`,
          } as CSSProperties
        }
      >
        <RivalSign x={x} width={width} height={height} name={name} />
      </g>
      <g transform={`translate(${x + width / 2} ${560 - height * 0.6}) scale(${k})`}>
        {SHARDS.map(([dx, dy, r], i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 조각 목록이다.
            key={i}
            className="toy-debris"
            d={i % 2 ? 'M0-7 6 5-5 3Z' : 'M-4-6 7-2 0 7Z'}
            fill={i % 3 ? '#cfe6f3' : '#ffdc8f'}
            stroke="#fff"
            strokeWidth="1"
            style={flyStyle(dx * dir, dy, r, (i % 3) * 0.05)}
          />
        ))}
      </g>
    </g>
  )
}

/** 커진 건물 축하 (phase 3) 중 건물 뒤의 빛줄기. */
function Rays({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} pointerEvents="none">
      <g className="toy-rays">
        <circle r="120" fill="#fff6cf" opacity=".55" />
        <path d={RAYS} fill="#fff3b0" />
      </g>
    </g>
  )
}

/** 커진 건물 둘레의 반짝이 (phase 3). */
function Sparkles({ points, k }: { points: [number, number][]; k: number }) {
  return (
    <g pointerEvents="none" data-testid="toy-celebration">
      {points.map(([px, py], i) => (
        <g key={`${px}-${py}`} transform={`translate(${px} ${py}) scale(${k * (i % 3 ? 1 : 1.5)})`}>
          <path
            className="toy-sparkle"
            d={STAR}
            fill="#fff6b0"
            stroke="#f5b84b"
            strokeWidth="1.5"
            style={{ animationDelay: `${(i % 4) * 0.1}s` }}
          />
        </g>
      ))}
    </g>
  )
}

/** 실제 배치된 직원만 그린다. 인력 관리는 별도 탭에서 한다. */
export function ToyCityStreet({
  company,
  transition,
  onUpgrade,
  skip = false,
  onPhase,
}: {
  company: Company
  transition?: OfficeTransition
  onUpgrade?: () => void
  /** 화면을 눌러 연출을 건너뛰면 바로 끝 모습으로 간다. */
  skip?: boolean
  onPhase?: (phase: MovePhase) => void
}) {
  const [phase, setPhase] = useState<MovePhase>(() =>
    transition && !skip && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : MOVE_DONE,
  )
  const wall = useId().replaceAll(':', '')
  const roof = useRef<SVGCircleElement>(null)
  const report = useRef(onPhase)
  report.current = onPhase
  const up = Boolean(
    transition && LADDER.indexOf(transition.after) > LADDER.indexOf(transition.before),
  )
  useEffect(() => {
    if (!transition || skip || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(MOVE_DONE)
      return
    }
    setPhase(0)
    // 등급이 오를 때만 소리·진동을 낸다 (399번). 내려가면 조용히 예전처럼.
    if (up) {
      sfx.charge()
      haptic.light()
    }
    const timers = moveTimeline(up).map(({ phase: next, at }) =>
      setTimeout(() => {
        setPhase(next)
        if (!up) return
        if (next === 1) {
          sfx.crash()
          haptic.heavy()
        } else if (next === 2) {
          sfx.crumble()
          haptic.medium()
        } else if (next === 3) {
          sfx.celebrate()
          haptic.success()
        }
      }, at),
    )
    return () => timers.forEach(clearTimeout)
  }, [transition, skip, up])
  useEffect(() => {
    report.current?.(phase)
    // 색종이는 화면 맨 위 효과 층(FxLayer)에 터뜨린다: 캔버스라 조각이 많아도 가볍고, 움직임 줄이기면 그리지 않는다.
    if (phase === 3) useFx.getState().burstAt(roof.current, 'confetti')
  }, [phase])
  const side = expansionSide(transition?.after ?? company.grade)
  const dir = side === 'left' ? -1 : 1
  const before = officeGeometry(
    transition?.before ?? company.grade,
    transition?.beforeSeats ?? company.seats,
  )
  const after = officeGeometry(company.grade, company.seats)
  const g = phase < 2 ? before : after
  const camera = phase < 1 ? before : after
  const { x, width: w, height: h, center } = g
  const top = 560 - h
  const employees = company.employees.filter((e) => e.desk).slice(0, g.positions.length)
  const oldRivals = phase < 3 && transition
  const rivalGeometry = oldRivals ? before : after
  const rivalGrade = oldRivals ? transition.before : company.grade
  const rivalWidth = Math.max(
    130 / rivalGeometry.scale,
    219 / rivalGeometry.scale - rivalGeometry.width / 2,
  )
  // 카메라가 물러나도 화면에서 보이는 골목 폭은 유지한다.
  const rivalGap = 28 / rivalGeometry.scale
  const targetSide = company.upgrade ? expansionSide(company.upgrade.to) : null
  const targetX =
    targetSide === 'left'
      ? Math.max(58, (195 - (after.width * after.scale) / 2 - 28) / 2)
      : Math.min(332, (195 + (after.width * after.scale) / 2 + 28 + 390) / 2)
  const targetY =
    560 + 10 * after.scale - (targetSide === 'left' ? 220 : 242) - 7 * after.scale - 70
  const plan = company.upgrade
  const showGoal = onUpgrade && plan && !transition && company.status !== 'ENDED' && !company.broke
  // 부딪힘 연출: 우리 건물은 골목만큼 내달려 옆 건물에 닿는다. 효과는 카메라 축척(k)을 되돌려 화면에서 같은 크기로 그린다.
  const beforeGap = 28 / before.scale
  const k = 1 / after.scale
  const impactX =
    side === 'left' ? before.x - beforeGap / 2 : before.x + before.width + beforeGap / 2
  const impactY = 560 - Math.min(before.height, 220 / before.scale) * 0.45
  const hitRival = up && phase === 2
  const evicted = {
    x: side === 'left' ? before.x - rivalWidth - beforeGap : before.x + before.width + beforeGap,
    height: (side === 'left' ? 220 : 242) / before.scale,
  }
  const celebrate = up && phase === 3
  const buildingStyle = {
    transformOrigin: `${center}px 560px`,
    '--toy-hit': `${dir * (beforeGap + 2)}px`,
    '--toy-from-x': before.width / after.width,
    '--toy-from-y': before.height / after.height,
  } as CSSProperties
  const motion = !up
    ? ''
    : phase === 0
      ? ' toy-windup'
      : phase === 1
        ? ' toy-recoil'
        : phase === 2
          ? ' toy-pop'
          : ''
  const sparkles: [number, number][] = [
    [after.x - 14, 560 - after.height * 0.35],
    [after.x + after.width + 14, 560 - after.height * 0.5],
    [after.center, 560 - after.height - 70],
    [after.x + 10, 560 - after.height - 30],
    [after.x + after.width - 10, 560 - after.height - 40],
    [after.x - 26, 560 - after.height * 0.8],
    [after.x + after.width + 24, 560 - after.height * 0.15],
    [after.center + after.width * 0.3, 560 - after.height - 90],
  ]
  return (
    <svg
      className={`toy-street${celebrate ? ' toy-celebrate' : ''}`}
      viewBox="0 0 390 814"
      preserveAspectRatio="xMidYMid slice"
      aria-label={`우리 회사 · 자리 ${company.seats}개`}
      data-testid="toy-street"
      data-seats={company.seats}
      data-phase={phase}
      data-direction={transition ? side : undefined}
    >
      <defs>
        <linearGradient id={wall} x2="0" y2="1">
          <stop stopColor="#fff7e5" />
          <stop offset="1" stopColor="#f0ddba" />
        </linearGradient>
      </defs>
      <rect width="390" height="814" fill="#b9ddf2" />
      <circle cx="75" cy="250" r="32" fill="#fff0b9" />
      <g fill="#fff" opacity=".5">
        <rect x="28" y="233" width="95" height="12" rx="6" />
        <rect x="51" y="220" width="40" height="19" rx="10" />
        <rect x="260" y="218" width="68" height="10" rx="5" />
      </g>
      <g
        className={phase === 1 ? 'toy-camera toy-camera-stop' : 'toy-camera'}
        style={{
          transform: `translate(${195 - camera.center * camera.scale}px,${560 - 550 * camera.scale}px) scale(${camera.scale})`,
        }}
      >
        {/* 옆 건물이 밀려날 때 땅이 들썩인다 (399번). */}
        <g className={hitRival ? 'toy-ground toy-quake' : 'toy-ground'}>
          <g fill="#9ec7dc">
            {Array.from({ length: 17 }, (_, i) => (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 배경 건물 좌표다.
                key={`sky-${i}`}
                x={-500 + i * 75}
                y={260 + ((i * 47) % 130)}
                width="50"
                height="330"
                rx="4"
              />
            ))}
          </g>
          <path d="M-700 555h1800v500H-700" fill="#b9d8c6" />
          <path d="M-700 609h1800v446H-700" fill="#a0c7b8" />
          <path d="M-700 620h1800" stroke="#c8dfd0" strokeWidth="5" />
        </g>
        {celebrate && <Rays x={after.center} y={560 - after.height * 0.6} k={k} />}
        <Rival
          x={rivalGeometry.x - rivalWidth - rivalGap}
          width={rivalWidth}
          height={220 / rivalGeometry.scale}
          name={rivalName(rivalGrade, 'left')}
          hit={hitRival && side === 'left' ? 'left' : undefined}
          fly={-420 * k}
        />
        <Rival
          x={rivalGeometry.x + rivalGeometry.width + rivalGap}
          width={rivalWidth}
          height={242 / rivalGeometry.scale}
          name={rivalName(rivalGrade, 'right')}
          hit={hitRival && side === 'right' ? 'right' : undefined}
          fly={420 * k}
        />
        <g className={`toy-building${motion}`} style={buildingStyle}>
          <ellipse cx={center} cy="569" rx={w / 2 + 12} ry="11" fill="#34486122" />
          <path d={`M${x} ${top}l13-10h${w}v${h}l-13 10`} fill="#d4b38a" />
          <rect x={x} y={top} width={w} height={h} rx="7" fill={`url(#${wall})`} />
          <rect x={x + 12} y={top + 24} width={w - 24} height="25" rx="4" fill="#a9c9d3" />
          {[1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${x + (w * i) / 4} ${top + 24}v25`}
              stroke="#fff4db"
              strokeWidth="4"
            />
          ))}
          {Array.from({ length: g.rows }, (_, row) => {
            const y = 560 - 128 - row * 86
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: 아래층부터 고정된 층 번호다.
              <g key={`floor-${row}`}>
                <rect x={x + 10} y={y} width={w - 20} height="73" rx="3" fill="#ffdfb0" />
                <path d={`M${x + 8} ${y + 75}h${w - 16}`} stroke="#cdb28b" strokeWidth="5" />
              </g>
            )
          })}
          <path
            d={`M${x + 4} ${top + 10}v${h - 15}m${w - 8}-${h - 15}v${h - 15}`}
            stroke="#f9eacc"
            strokeWidth="7"
          />
          <rect x={center - 21} y="529" width="42" height="32" rx="4" fill="#8eb4ca" />
          <path d={`M${center} 530v31`} stroke="#fff4db" strokeWidth="3" />
          <path
            d={`M${x - 5} 565h${w + 10}`}
            stroke="#bd9f7d"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d={`M${x - 5} ${top}l13-10h${w + 7}l-13 10`} fill="#7797ce" />
          <rect x={x - 5} y={top} width={w + 11} height="11" rx="3" fill="#557ac0" />
          <rect x={center - 60} y={top - 31} width="120" height="25" rx="6" fill="#557ac0" />
          <text
            x={center}
            y={top - 14}
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            fill="#fff9df"
          >
            흔들리지 않는 고양이
          </text>
          {employees.map((employee, i) => {
            const p = g.positions[i]
            return (
              <g
                key={employee.id}
                transform={`translate(${p.x},${p.y + 17})`}
                className="toy-resident"
                aria-label={employee.name}
              >
                <ellipse cx="18" cy="41" rx="17" ry="3" fill="#b4917433" />
                <g
                  className="toy-cat"
                  data-testid="toy-employee"
                  style={{ '--toy-jump-delay': `${(i % 3) * 0.06}s` } as CSSProperties}
                >
                  <CatFigure id={employee.id} grade={employee.overallGrade} />
                </g>
              </g>
            )
          })}
        </g>
        <g transform="translate(177 612) scale(1.25)">
          <g className="toy-cat">
            <CatFigure />
          </g>
        </g>
        {up && (phase === 1 || phase === 2) && (
          <Impact x={impactX} y={impactY} ground={558} k={k} dir={dir} />
        )}
        {hitRival && (
          <Eviction
            x={evicted.x}
            width={rivalWidth}
            height={evicted.height}
            name={rivalName(transition?.before ?? company.grade, side)}
            k={k}
            dir={dir}
          />
        )}
        {celebrate && <Sparkles points={sparkles} k={k} />}
        <circle ref={roof} cx={after.center} cy={540 - after.height} r="1" fill="none" />
      </g>
      {showGoal && plan && (
        <foreignObject x={targetX - 50} y={targetY} width="100" height="72">
          <button
            type="button"
            className="toy-rival-goal"
            onClick={onUpgrade}
            data-testid="rival-goal"
            data-side={targetSide}
            aria-label={`${rivalName(company.grade, targetSide ?? 'left')} 밀어내기 목표 자본 ${money(plan.needed)}`}
          >
            <span>목표 자본</span>
            <strong>{money(plan.needed)}</strong>
            <small>
              {plan.left != null
                ? `공사 ${plan.left}년 남음`
                : plan.affordable
                  ? '확장 가능!'
                  : `${money(Math.max(0, plan.needed - company.capital))} 더 필요`}
            </small>
          </button>
        </foreignObject>
      )}
    </svg>
  )
}
