import { memo } from 'react'
import type { Grade } from '../../api/client'
import { PALETTE } from '../game/pixel/palette'
import { toRuns } from '../game/pixel/sprite'
import { usePixelArt } from '../game/pixelArt'
import { hasProp, OFFICE_NAMES, TIER_ORDER, TIER_SHORT, type Tier, tierOf } from './office'

const W = 64
const H = 40
/** 길바닥이 시작하는 행 */
const GROUND = 36

type Grid = string[][]

function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (j >= 0 && j < H && i >= 0 && i < W) {
        g[j][i] = ch
      }
    }
  }
}

/** 이웃 건물(회색). 큰 건물일수록 도시 한가운데에 있다. */
function skyline(g: Grid, heights: [number, number, number][]) {
  for (const [x, w, top] of heights) {
    rect(g, x, top, w, GROUND - top, 'C')
    for (let y = top + 2; y < GROUND - 1; y += 3) {
      for (let i = x + 1; i < x + w - 1; i += 3) {
        rect(g, i, y, 1, 1, 'H')
      }
    }
  }
}

/**
 * 층마다 창이 늘어선 몸통. lit은 우리 회사가 쓰는 층 수(아래부터)이고 그 층의 창은 불이 켜져 있다(L). 나머지 층은 꺼진 유리(Z).
 */
function tower(
  g: Grid,
  x: number,
  w: number,
  top: number,
  floorH: number,
  lit: number | 'all',
  frame: string,
) {
  rect(g, x, top, w, GROUND - top, frame)
  let floor = 0
  for (let y = GROUND - floorH; y >= top + 1; y -= floorH, floor++) {
    const on = lit === 'all' || floor < lit
    rect(g, x + 1, y, w - 2, floorH - 1, on ? 'L' : 'Z')
    for (let i = x + 3; i < x + w - 1; i += 4) {
      rect(g, i, y, 1, floorH - 1, frame)
    }
  }
}

/**
 * 등급마다 건물 겉모습 (증권사 육성 설계 8.1절, decisions.md 238번). 우리 회사가 쓰는 층은 창에 불이 켜져 있다. bare면 하늘·이웃 건물·길바닥 없이 건물만
 * 그린다(빈 칸은 '.', 투명): 라이벌 박치기 장면(243번)이 건물만 따로 움직인다.
 */
export function buildingMap(grade: Grade, bare = false): Grid {
  const g: Grid = Array.from({ length: H }, () => Array<string>(W).fill(bare ? '.' : 'S'))
  const tier: Tier = tierOf(grade)
  if (!bare) {
    rect(g, 0, GROUND, W, H - GROUND, 'A')
    rect(g, 0, GROUND, W, 1, 'N')
  }
  const city = (heights: [number, number, number][]) => {
    if (!bare) {
      skyline(g, heights)
    }
  }
  switch (tier) {
    case 'basement': {
      // 3층 빌라. 우리 회사는 길바닥 높이에 반쯤 묻힌 반지하 창 하나.
      rect(g, 16, 12, 32, 2, 'X')
      rect(g, 18, 14, 28, GROUND - 14, 'M')
      for (const y of [16, 23, 30]) {
        for (const x of [21, 37]) {
          rect(g, x, y, 6, 4, 'N')
          rect(g, x + 1, y + 1, 4, 2, 'Z')
        }
      }
      rect(g, 30, 29, 4, 7, 'D')
      rect(g, 21, 35, 8, 3, 'N')
      rect(g, 22, 35, 6, 2, 'L')
      if (!bare) {
        rect(g, 4, 30, 1, 6, 'V')
        rect(g, 2, 28, 5, 2, 'g')
      }
      break
    }
    case 'shop': {
      // 2층 상가. 1층은 가게 유리, 2층이 우리 사무실(불 켜짐)과 노란 간판.
      city([
        [2, 10, 20],
        [52, 10, 18],
      ])
      rect(g, 14, 14, 36, GROUND - 14, 'H')
      rect(g, 14, 13, 36, 1, 'N')
      rect(g, 16, 16, 32, 7, 'N')
      rect(g, 17, 17, 30, 5, 'L')
      rect(g, 16, 24, 32, 3, 'y')
      rect(g, 16, 28, 32, 8, 'Z')
      rect(g, 30, 28, 4, 8, 'N')
      break
    }
    case 'small': {
      city([
        [2, 12, 14],
        [50, 12, 18],
      ])
      rect(g, 17, 5, 30, 1, 'N')
      tower(g, 17, 30, 6, 6, 1, 'F')
      rect(g, 29, 30, 6, 6, 'D')
      break
    }
    case 'yeouido': {
      city([
        [1, 12, 10],
        [51, 12, 6],
      ])
      tower(g, 18, 28, 2, 3, 4, 'K')
      break
    }
    case 'whole': {
      city([
        [1, 12, 10],
        [51, 12, 6],
      ])
      tower(g, 18, 28, 4, 3, 'all', 'K')
      rect(g, 22, 1, 20, 3, 'y')
      break
    }
    case 'hq': {
      // 우리 이름이 붙은 사옥: 넓고 꼭대기에 금빛 로고.
      city([
        [0, 10, 12],
        [54, 10, 8],
      ])
      tower(g, 12, 40, 7, 3, 'all', 'K')
      rect(g, 20, 1, 24, 6, 'K')
      rect(g, 22, 2, 20, 4, 'y')
      rect(g, 30, 3, 4, 2, 'W')
      break
    }
    case 'landmark': {
      // 랜드마크 타워: 가늘고 높이 솟아 꼭대기에 금빛 왕관과 첨탑.
      city([
        [0, 12, 18],
        [52, 12, 14],
        [12, 8, 24],
        [44, 8, 22],
      ])
      tower(g, 22, 20, 8, 3, 'all', 'K')
      rect(g, 24, 5, 16, 3, 'y')
      rect(g, 28, 2, 8, 3, 'y')
      rect(g, 31, 0, 2, 2, 'y')
      break
    }
  }
  if (hasProp(grade)) {
    // 같은 건물 안에서 한 단계 오른 등급: 입구 옆 화분.
    rect(g, 50, GROUND - 4, 3, 4, 'P')
    rect(g, 50, GROUND - 7, 3, 3, 'g')
  }
  return g
}

/** 건물 사다리: 일곱 건물 가운데 지금 어디인지 (회사 등급 사다리 대신, 238번). */
function BuildingLadder({ tier }: { tier: Tier }) {
  const at = TIER_ORDER.indexOf(tier)
  return (
    <ol
      className="mt-2 flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[11px]"
      aria-label="건물 사다리"
      data-testid="building-ladder"
    >
      {TIER_ORDER.map((t, i) => (
        <li
          key={t}
          className={`flex items-center gap-0.5 ${i > at + 1 ? 'opacity-40' : ''}`}
          aria-current={i === at ? 'step' : undefined}
        >
          {i > 0 && (
            <span className="text-muted" aria-hidden="true">
              ›
            </span>
          )}
          <span
            className={`rounded-sm px-1 leading-5 ${
              i === at
                ? 'bg-wine font-bold text-white'
                : i < at
                  ? 'bg-line-soft text-muted line-through'
                  : 'border border-line text-ink'
            }`}
          >
            {TIER_SHORT[t]}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** 회사 화면 맨 위의 건물 (238번). 회사 등급 글자 대신 지금 쓰는 건물을 그림으로 보인다. 그림을 끄면 이름과 사다리만. */
export const BuildingArt = memo(function BuildingArt({ grade }: { grade: Grade }) {
  const shown = usePixelArt((s) => s.shown)
  const tier = tierOf(grade)
  return (
    <div data-testid="building" data-tier={tier}>
      {shown && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto mt-2 block h-auto w-full max-w-[360px] rounded border border-line"
          style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
          role="img"
          aria-label={OFFICE_NAMES[tier]}
        >
          {toRuns(buildingMap(grade), PALETTE).map((r) => (
            <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
          ))}
        </svg>
      )}
      <BuildingLadder tier={tier} />
    </div>
  )
})
