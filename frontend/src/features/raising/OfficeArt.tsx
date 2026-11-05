import { memo } from 'react'
import type { Company, Grade } from '../../api/client'
import type { Figure } from '../game/pixel/figure'
import { Person } from '../game/pixel/Person'
import { PALETTE } from '../game/pixel/palette'
import { SPRITE_HEIGHT, SPRITE_WIDTH, toRuns } from '../game/pixel/sprite'
import { usePixelArt } from '../game/pixelArt'
import { bubbleOf, pnlLabel } from './board'
import {
  ATTIRE_COLORS,
  attireOf,
  customersOf,
  glowOf,
  hasProp,
  lobbyOf,
  officeCaption,
  type Tier,
  tierOf,
} from './office'

/** 건물 위 간판 줄, 사무실 층, 객장 층의 높이(칸). 사람 하나가 16×20 칸이다. */
const ROOF = 5
const FLOOR = 26
const HEIGHT = ROOF + FLOOR * 2
/** 자리 하나의 폭: 옆모습의 사람(가운데 8칸쯤) + 책상과 모니터 */
const SEAT = 24
/** 자리 안에서 모니터가 놓이는 열. 옆모습 사람의 얼굴 앞이다 */
const MONITOR_X = 13

type Grid = string[][]

function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (g[j] && i >= 0 && i < g[j].length) {
        g[j][i] = ch
      }
    }
  }
}

/** 등급마다 건물 겉모습: 간판 줄의 색과 벽 색 (8.1절 표). */
const LOOKS: Record<Tier, { roof: string; wall: string; trim: string }> = {
  basement: { roof: 'A', wall: 'H', trim: 'D' },
  shop: { roof: 'X', wall: 'F', trim: 'N' },
  small: { roof: 'M', wall: 'F', trim: 'N' },
  yeouido: { roof: 'Z', wall: 'F', trim: 'K' },
  whole: { roof: 'Z', wall: 'F', trim: 'K' },
  hq: { roof: 'K', wall: 'F', trim: 'K' },
  landmark: { roof: 'y', wall: 'F', trim: 'y' },
}

/** 사무실 단면의 배경. 사람은 따로 겹친다. */
export function officeMap(grade: Grade, seats: number, width: number): Grid {
  const tier = tierOf(grade)
  const look = LOOKS[tier]
  const g: Grid = Array.from({ length: HEIGHT }, () => Array<string>(width).fill('.'))
  const lobby = lobbyOf(grade)

  // 간판 줄
  fill(g, 0, 0, width, ROOF, 'S')
  if (tier === 'basement') {
    // 반지하: 길바닥이 사무실 창 높이에 있다.
    fill(g, 0, ROOF - 2, width, 2, 'A')
  } else {
    fill(g, 2, 1, width - 4, ROOF - 1, look.roof)
    for (let x = 6; x < width - 6; x += 4) {
      fill(g, x, 2, 2, 1, tier === 'hq' ? 'U' : 'W')
    }
  }
  if (lobby.logo) {
    // 스카이라인 한가운데 우리 로고
    fill(g, Math.floor(width / 2) - 3, 0, 6, ROOF, 'y')
    fill(g, Math.floor(width / 2) - 1, 1, 2, ROOF - 2, 'W')
  }

  // 사무실 층
  const top = ROOF
  fill(g, 0, top, width, FLOOR, look.wall)
  fill(g, 0, top, width, 2, look.trim)
  fill(g, 0, top + FLOOR - 3, width, 3, 'D')
  if (tier === 'basement') {
    // 천장 바로 밑의 작은 창
    fill(g, width - 14, top + 2, 10, 3, 'N')
    fill(g, width - 13, top + 3, 8, 1, 'A')
  } else {
    fill(g, width - 14, top + 3, 10, 7, 'N')
    fill(g, width - 13, top + 4, 8, 5, 'S')
  }
  for (let i = 0; i < seats; i++) {
    // 사람은 자리 왼쪽에 옆모습으로 서서, 오른쪽 책상 위 모니터를 본다 (196번).
    const x = i * SEAT + MONITOR_X
    fill(g, x, top + 7, 10, 7, 'K')
    fill(g, x + 1, top + 8, 8, 5, 'Z')
    fill(g, x + 2, top + 11, 2, 1, 'U')
    fill(g, x + 4, top + 10, 2, 1, 'U')
    fill(g, x + 6, top + 9, 2, 1, 'U')
    fill(g, x + 4, top + 14, 2, 1, 'K')
    fill(g, x - 2, top + 15, 14, 1, 'T')
    fill(g, x - 1, top + 16, 1, FLOOR - 19, 'T')
    fill(g, x + 10, top + 16, 1, FLOOR - 19, 'T')
  }
  if (hasProp(grade)) {
    const x = Math.min(width - 6, 3 + seats * SEAT)
    fill(g, x, top + FLOOR - 7, 4, 4, 'P')
    fill(g, x + 1, top + FLOOR - 11, 2, 4, 'g')
  }

  // 객장 층
  const lobbyTop = ROOF + FLOOR
  fill(g, 0, lobbyTop, width, FLOOR, 'F')
  fill(g, 0, lobbyTop, width, 2, look.trim)
  fill(g, 0, lobbyTop + FLOOR - 3, width, 3, 'D')
  // 창구
  fill(g, 2, lobbyTop + 14, 14, 9, 'T')
  fill(g, 2, lobbyTop + 13, 14, 1, 'N')
  if (lobby.board) {
    // 사옥 전광판에 우리 시세
    fill(g, 20, lobbyTop + 3, width - 26, 6, 'K')
    for (let i = 0; i < width - 30; i += 2) {
      fill(g, 22 + i, lobbyTop + 7 - ((i / 2) % 4), 2, 1, 'U')
    }
  }
  if (lobby.ticket) {
    fill(g, 18, lobbyTop + 13, 4, 10, 'K')
    fill(g, 19, lobbyTop + 14, 2, 2, 'Z')
  }
  if (lobby.chairs) {
    for (let x = 24; x < width - 6; x += 6) {
      fill(g, x, lobbyTop + 19, 4, 1, 'N')
      fill(g, x, lobbyTop + 20, 1, 3, 'N')
    }
  }
  if (customersOf(grade) === 0) {
    // 손님 대신 길고양이 한 마리
    const x = width - 12
    const y = lobbyTop + FLOOR - 6
    fill(g, x, y + 1, 5, 2, 'C')
    fill(g, x + 4, y, 2, 2, 'C')
    fill(g, x - 1, y, 1, 2, 'C')
    fill(g, x + 5, y - 1, 1, 1, 'C')
  }
  return g
}

/**
 * 회사 건물 단면 (8.1·8.2절). 책상 옆에는 직원이 모니터를 바라보는 옆모습으로 서 있고, 차림새는 종합 등급을 따른다. 객장 손님은 회사 등급만큼 선다. 그림을 끄면
 * 같은 내용을 글로 보인다 (190번).
 */
export const OfficeArt = memo(function OfficeArt({ company }: { company: Company }) {
  const shown = usePixelArt((s) => s.shown)
  const caption = officeCaption(company.grade, company.seats)
  if (!shown) {
    return (
      <p className="mt-3 text-[13px] text-muted" data-testid="office-caption">
        {caption}
      </p>
    )
  }
  const width = Math.max(64, 4 + company.seats * SEAT)
  const map = officeMap(company.grade, company.seats, width)
  const seated = company.employees.filter((e) => e.desk)
  const officeTop = ROOF + FLOOR - 3 - SPRITE_HEIGHT
  const lobbyTop = ROOF + FLOOR * 2 - 3 - SPRITE_HEIGHT
  // 지난 결산을 그림 속에서 (8.3절): 직원 머리 위에 손익과 결과에 맞는 한마디, 발밑에 앉은 자리.
  const resultOf = new Map((company.lastSettlement?.results ?? []).map((r) => [r.employeeId, r]))
  const deskName = new Map(company.desks.map((d) => [d.code, d.name]))
  const tags = seated.map((e, i) => {
    const r = resultOf.get(e.id)
    return {
      id: e.id,
      name: e.name,
      x: i * SEAT,
      desk: deskName.get(e.desk ?? '') ?? '',
      pnl: r && r.stake > 0 ? r.pnl : null,
      bubble: r ? bubbleOf(r.flips, r.pnl) : null,
    }
  })
  const staff: (Figure & { glow: 'blue' | 'gold' | null })[] = seated.map((e, i) => ({
    who: 'me',
    sex: e.id % 2 === 0 ? 'F' : 'M',
    stage: 'adult',
    x: i * SEAT,
    view: 'side',
    facing: 'right',
    recolor: ATTIRE_COLORS[attireOf(e.overallGrade)],
    glow: glowOf(e.overallGrade),
  }))
  const lobby = lobbyOf(company.grade)
  const customers: Figure[] = Array.from({ length: customersOf(company.grade) }, (_, i) => ({
    who: 'kid',
    look: i,
    sex: i % 2 === 0 ? 'M' : 'F',
    stage: 'adult',
    // 줄이 문밖까지면 촘촘히 선다.
    x: width - 18 - i * (lobby.line ? 6 : 9),
    view: i % 3 === 2 ? 'side' : 'front',
    facing: 'left',
  }))
  return (
    <figure className="relative mt-3">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block h-auto w-full rounded"
        style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
        role="img"
        aria-label={caption}
        data-testid="office-art"
        data-staff={staff.length}
        data-customers={customers.length}
      >
        {toRuns(map, PALETTE).map((r) => (
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
        ))}
        {staff.map((f) => (
          <g key={f.x}>
            {f.glow && (
              <rect
                x={f.x + 2}
                y={officeTop - 1}
                width={SPRITE_WIDTH - 4}
                height={SPRITE_HEIGHT - 4}
                rx={3}
                fill={f.glow === 'gold' ? '#e3b53a' : '#4f8fd6'}
                opacity={0.45}
                data-testid={`glow-${f.glow}`}
              />
            )}
            <Person figure={f} me={{ adornment: null, mark: null }} mood={null} top={officeTop} />
          </g>
        ))}
        {customers.map((f) => (
          <Person
            key={f.x}
            figure={f}
            me={{ adornment: null, mark: null }}
            mood={null}
            top={lobbyTop}
          />
        ))}
      </svg>
      {tags.map((t) => {
        const left = `${((t.x + SPRITE_WIDTH / 2) / width) * 100}%`
        return (
          <div key={t.id}>
            {(t.bubble || t.pnl !== null) && (
              <div
                className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5"
                style={{ left, top: `${((officeTop + 2) / HEIGHT) * 100}%` }}
              >
                {t.pnl !== null && (
                  <b
                    className={`animate-reveal rounded px-1 font-mono-num text-[11px] text-white ${
                      t.pnl >= 0 ? 'bg-up' : 'bg-down'
                    }`}
                    data-testid="office-pnl"
                  >
                    {pnlLabel(t.pnl)}
                  </b>
                )}
                {t.bubble && (
                  <span
                    className="w-max max-w-[38vw] rounded bg-white px-1.5 py-0.5 text-center text-[11px] leading-tight text-ink shadow md:max-w-[220px]"
                    data-testid="office-bubble"
                  >
                    {t.bubble}
                  </span>
                )}
              </div>
            )}
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap rounded bg-ink/80 px-1 text-[10px] text-white"
              style={{ left, top: `${((ROOF + FLOOR - 3) / HEIGHT) * 100}%` }}
              data-testid="office-tag"
            >
              {t.name} · {t.desk}
            </span>
          </div>
        )
      })}
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  )
})
