import type { Company, Grade } from '@web/api/client'
import { breedOf } from '@web/features/game/cat/look'
import { LADDER } from '@web/features/raising/grades'
import { type CSSProperties, useEffect, useId, useState } from 'react'
import { expansionSide, officeGeometry, rivalName } from './model'

export type OfficeTransition = { before: Grade; after: Grade; beforeSeats: number }

function Cat({ id = 0, grade = 'F' }: { id?: number; grade?: Grade }) {
  const fur = breedOf(id).fur
  return (
    <g>
      <path d="M8 39Q7 22 18 22t10 17" fill={LADDER.indexOf(grade) >= 6 ? '#526780' : '#779a9a'} />
      <path d="m14 24 4 5 4-5" fill="#fff9e9" />
      <path d="m17 29-2 7 3 3 3-3-2-7" fill="#e9af5b" />
      <path d="M5 14 4 2l11 7h6L32 2l-1 14q0 10-13 10T5 14" fill={fur} />
      <path d="m7 5 5 5-5 2m22-7-5 5 5 2" fill="#eaa99a" />
      <circle cx="12" cy="17" r="1.3" fill="#40424b" />
      <circle cx="24" cy="17" r="1.3" fill="#40424b" />
      <path
        d="m16 21 2 1 2-1"
        fill="none"
        stroke="#80645c"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  )
}

function Rival({
  x,
  height,
  name,
  hit,
}: {
  x: number
  height: number
  name: string
  hit?: 'left' | 'right'
}) {
  return (
    <g
      className={hit ? `toy-rival toy-evict-${hit}` : 'toy-rival'}
      style={{ transformOrigin: `${x + 29}px 560px` }}
      data-hit={hit}
    >
      <path d={`M${x} ${560 - height}l9-7h58v${height}l-9 7`} fill="#8fa5c8" />
      <rect x={x} y={560 - height} width="58" height={height} rx="5" fill="#b9c7e2" />
      <rect x={x + 4} y={568 - height} width="50" height="18" rx="3" fill="#829bc4" />
      <text
        x={x + 29}
        y={580 - height}
        textAnchor="middle"
        fontSize="6.5"
        fill="#fff"
        fontWeight="700"
      >
        {name}
      </text>
      {Array.from({ length: Math.floor((height - 44) / 28) }, (_, r) =>
        [0, 1].map((col) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 건물 창문 좌표다.
            key={`${r}-${col}`}
            x={x + 8 + col * 25}
            y={595 - height + r * 28}
            width="17"
            height="18"
            rx="3"
            fill={(r + col) % 3 ? '#97b5c9' : '#ffdc8f'}
          />
        )),
      )}
      <rect x={x + 19} y="537" width="22" height="23" fill="#829bc4" />
    </g>
  )
}

/** 실제 배치된 직원만 그린다. 인력 관리는 별도 탭에서 한다. */
export function ToyCityStreet({
  company,
  transition,
}: {
  company: Company
  transition?: OfficeTransition
}) {
  const [phase, setPhase] = useState(transition ? 0 : 3)
  const wall = useId().replaceAll(':', '')
  useEffect(() => {
    if (!transition) {
      setPhase(3)
      return
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(3)
      return
    }
    setPhase(0)
    const timers = [
      setTimeout(() => setPhase(1), 350),
      setTimeout(() => setPhase(2), 650),
      setTimeout(() => setPhase(3), 1500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [transition])
  const up = transition && LADDER.indexOf(transition.after) > LADDER.indexOf(transition.before)
  const side = expansionSide(transition?.after ?? company.grade)
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
  const moving = Boolean(transition && phase < 3)
  const buildingStyle = {
    transformOrigin: `${center}px 560px`,
    '--toy-hit': side === 'left' ? '-22px' : '22px',
    '--toy-from-x': before.width / after.width,
    '--toy-from-y': before.height / after.height,
  } as CSSProperties
  return (
    <svg
      className="toy-street"
      viewBox="0 0 390 814"
      preserveAspectRatio="xMidYMid slice"
      role="img"
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
        className="toy-camera"
        style={{
          transform: `translate(${195 - camera.center * camera.scale}px,${560 - 550 * camera.scale}px) scale(${camera.scale})`,
        }}
      >
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
        <Rival
          x={rivalGeometry.x - 66}
          height={Math.min(350, rivalGeometry.height + 25)}
          name={rivalName(rivalGrade, 'left')}
          hit={up && moving && side === 'left' ? 'left' : undefined}
        />
        <Rival
          x={rivalGeometry.x + rivalGeometry.width + 8}
          height={Math.min(380, rivalGeometry.height + 50)}
          name={rivalName(rivalGrade, 'right')}
          hit={up && moving && side === 'right' ? 'right' : undefined}
        />
        <g
          className={
            up && phase < 2
              ? 'toy-building toy-hit'
              : up && phase === 2
                ? 'toy-building toy-pop'
                : 'toy-building'
          }
          style={buildingStyle}
        >
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
                <g className="toy-cat" data-testid="toy-employee">
                  <Cat id={employee.id} grade={employee.overallGrade} />
                </g>
              </g>
            )
          })}
        </g>
        <g transform="translate(177 612) scale(1.25)">
          <Cat />
        </g>
      </g>
    </svg>
  )
}
