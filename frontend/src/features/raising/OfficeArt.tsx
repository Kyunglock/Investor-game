import { memo } from 'react'
import type { Company, Grade } from '../../api/client'
import type { Figure } from '../game/pixel/figure'
import { Person } from '../game/pixel/Person'
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../game/pixel/sprite'
import { usePixelArt } from '../game/pixelArt'
import { pnlLabel } from './board'
import {
  ATTIRE_COLORS,
  attireOf,
  customersOf,
  FLOORS,
  glowOf,
  officeCaption,
  type SeatTile,
  seatTiles,
  tierOf,
  titleOf,
} from './office'

type Employee = Company['employees'][number]

/** 미니맵에서 고른 것: 앉아 있거나 쉬는 직원, 또는 빈 자리(몇 번째). 미니맵 아래에 자리 고르기가 열린다. */
export type SeatFocus = { employee: number } | { empty: number }

const PIXELATED = { imageRendering: 'pixelated', shapeRendering: 'crispEdges' } as const

/** 정면을 보는 직원 한 명. 차림새는 종합 등급, 표정은 그해 손익, X 이상은 뒤에 빛이 돈다 (8.2절). */
function Face({
  employee,
  mood,
  size,
}: {
  employee: Employee
  mood: SeatTile['mood']
  size: number
}) {
  const glow = glowOf(employee.overallGrade)
  const figure: Figure = {
    who: 'me',
    sex: employee.id % 2 === 0 ? 'F' : 'M',
    stage: 'adult',
    x: 0,
    recolor: ATTIRE_COLORS[attireOf(employee.overallGrade)],
  }
  return (
    <svg
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      width={size}
      height={(size * SPRITE_HEIGHT) / SPRITE_WIDTH}
      className="block"
      style={PIXELATED}
      aria-hidden="true"
    >
      {glow && (
        <circle
          cx={SPRITE_WIDTH / 2}
          cy={SPRITE_HEIGHT / 2 - 2}
          r={7}
          fill={glow === 'gold' ? '#e3b53a' : '#4f8fd6'}
          opacity={0.45}
          data-testid={`glow-${glow}`}
        />
      )}
      <Person figure={figure} me={{ adornment: null, mark: null }} mood={mood} top={0} />
    </svg>
  )
}

/** 객장 손님: 회사 등급만큼 작은 사람이 줄을 선다. F는 길고양이 한 마리 (8.1절). */
function Lobby({ grade }: { grade: Grade }) {
  const customers: Figure[] = Array.from({ length: customersOf(grade) }, (_, i) => ({
    who: 'kid',
    look: i,
    sex: i % 2 ? 'F' : 'M',
    stage: 'adult',
    x: i * SPRITE_WIDTH,
  }))
  return (
    <div
      className="mt-2 flex min-h-8 items-end gap-1 border-t-2 border-dashed border-ink/25 pt-1"
      data-testid="office-lobby"
    >
      <span className="self-center text-[10px] text-ink/60">객장</span>
      {customers.length === 0 ? (
        <span className="text-[13px]" role="img" aria-label="길고양이">
          🐈
        </span>
      ) : (
        <svg
          viewBox={`0 0 ${customers.length * SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
          width={customers.length * 16}
          height={20}
          style={PIXELATED}
          aria-hidden="true"
        >
          {customers.map((f) => (
            <Person key={f.x} figure={f} me={{ adornment: null, mark: null }} mood={null} top={0} />
          ))}
        </svg>
      )}
    </div>
  )
}

/**
 * 사무실 미니맵 (decisions.md 237번). 옆모습으로 책상에 앉은 단면 그림(213번) 대신, 위에서 내려다본 바닥에 자리 칸을 늘어놓고 칸마다 직원의 정면 모습·이름·자리·
 * 지난 결산 손익을 보인다. 빈 자리는 점선 칸이고, 쉬는 사람은 휴게실 줄에 선다. 칸을 누르면 미니맵 아래에서 바로 자리를 고른다. 그림을 끄면 같은 내용을 글로
 * 보인다 (190번).
 */
export const OfficeArt = memo(function OfficeArt({
  company,
  focus = null,
  onSeat,
}: {
  company: Company
  /** 고른 칸. 테두리로 보인다. */
  focus?: SeatFocus | null
  /** 있으면 칸을 누를 수 있다: 직원을 누르면 그 사람의 자리, 빈 자리를 누르면 앉힐 사람을 고른다. */
  onSeat?: (focus: SeatFocus) => void
}) {
  const shown = usePixelArt((s) => s.shown)
  const caption = officeCaption(company.grade, company.seats)
  if (!shown) {
    return (
      <p className="mt-3 text-[13px] text-muted" data-testid="office-caption">
        {caption}
      </p>
    )
  }
  const { tiles, resting } = seatTiles(company)
  const [a, b] = FLOORS[tierOf(company.grade)]
  const picked = (id: number) => focus !== null && 'employee' in focus && focus.employee === id
  const Tile = onSeat ? 'button' : 'div'
  return (
    <figure
      className="mt-3 rounded border-2 border-ink/70 p-2"
      style={{
        backgroundColor: a,
        backgroundImage: `linear-gradient(45deg, ${b} 25%, transparent 25%, transparent 75%, ${b} 75%), linear-gradient(45deg, ${b} 25%, transparent 25%, transparent 75%, ${b} 75%)`,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
      aria-label={caption}
      data-testid="office-art"
      data-staff={tiles.filter((t) => t.employee).length}
      data-customers={customersOf(company.grade)}
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-x-1.5 gap-y-2.5 pt-1.5">
        {tiles.map((t) => {
          const e = t.employee
          const on = e
            ? picked(e.id)
            : focus !== null && 'empty' in focus && focus.empty === t.index
          return (
            <li key={t.index} className="relative">
              <Tile
                {...(onSeat && {
                  type: 'button' as const,
                  onClick: () => onSeat(e ? { employee: e.id } : { empty: t.index }),
                  'aria-pressed': on,
                  'aria-label': e
                    ? `${e.name} · ${t.desk}, 자리 바꾸기`
                    : `빈 자리 ${t.index + 1}에 앉힐 사람 고르기`,
                })}
                className={`flex h-full min-h-[104px] w-full flex-col items-center justify-end rounded px-1 pt-3 pb-1 ${
                  e
                    ? `border-2 bg-white/85 shadow-sm ${t.trades ? 'border-teal' : 'border-gold'}`
                    : 'border-2 border-dashed border-ink/40 bg-white/40'
                } ${on ? 'ring-2 ring-pen ring-offset-1' : ''} ${onSeat ? 'hover:bg-white' : ''}`}
                data-testid={e ? 'office-seat' : 'office-empty'}
              >
                {e ? (
                  <>
                    <Face employee={e} mood={t.mood} size={44} />
                    <span className="mt-0.5 text-[12px] font-semibold leading-tight">
                      {e.name} {titleOf(e.overallGrade)}
                    </span>
                    <span
                      className={`text-center text-[10px] leading-tight ${
                        t.trades ? 'text-teal' : 'text-gold'
                      }`}
                      data-testid="office-tag"
                    >
                      {t.desk}
                    </span>
                  </>
                ) : (
                  <span className="my-auto text-[12px] text-ink/60">
                    빈 자리{onSeat ? ' +' : ''}
                  </span>
                )}
              </Tile>
              {t.pnl !== null && (
                <b
                  className={`animate-reveal pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 font-mono-num text-[10px] text-white ${
                    t.pnl >= 0 ? 'bg-up' : 'bg-down'
                  }`}
                  data-testid="office-pnl"
                >
                  {pnlLabel(t.pnl)}
                </b>
              )}
            </li>
          )
        })}
      </ul>
      {resting.length > 0 && (
        <div className="mt-2 rounded bg-white/50 px-1.5 py-1" data-testid="office-resting">
          <p className="text-[10px] text-ink/60">휴게실 · 쉬는 사람</p>
          <ul className="flex flex-wrap gap-1">
            {resting.map((e) => (
              <li key={e.id}>
                <Tile
                  {...(onSeat && {
                    type: 'button' as const,
                    onClick: () => onSeat({ employee: e.id }),
                    'aria-pressed': picked(e.id),
                    'aria-label': `쉬는 ${e.name}, 자리 고르기`,
                  })}
                  className={`flex items-center gap-1 rounded border border-ink/20 bg-white/80 py-0.5 pr-1.5 pl-0.5 ${
                    picked(e.id) ? 'ring-2 ring-pen' : ''
                  }`}
                >
                  <Face employee={e} mood={null} size={24} />
                  <span className="text-[11px]">{e.name}</span>
                </Tile>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Lobby grade={company.grade} />
      <figcaption className="mt-1 text-[11px] text-ink/70">{caption}</figcaption>
    </figure>
  )
})
