import { memo } from 'react'
import type { Grade } from '../../api/client'
import { PALETTE } from '../game/pixel/palette'
import { toRuns } from '../game/pixel/sprite'
import { usePixelArt } from '../game/pixelArt'
import { hasProp, OFFICE_NAMES, TIER_ORDER, TIER_SHORT, type Tier, tierOf } from './office'

/** 그림 크기(칸). 화면에는 최대 360px 너비로 그리므로 한 칸이 3px 안팎이다. */
export const BUILDING_W = 128
export const BUILDING_H = 80
/** 길바닥(보도)이 시작하는 행 */
export const BUILDING_GROUND = 72

const W = BUILDING_W
const H = BUILDING_H
const GROUND = BUILDING_GROUND

type Grid = string[][]

function put(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < H && x >= 0 && x < W) {
    g[y][x] = ch
  }
}

function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      put(g, i, j, ch)
    }
  }
}

/** 빛이 왼쪽 위에서 오는 상자: 위·왼쪽 가장자리는 밝게, 아래·오른쪽 가장자리는 그늘 */
function bevel(
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  light: string,
  shadow: string,
) {
  rect(g, x, y, w, h, base)
  rect(g, x, y, w, 1, light)
  rect(g, x, y, 1, h, light)
  rect(g, x + 1, y + h - 1, w - 1, 1, shadow)
  rect(g, x + w - 1, y + 1, 1, h - 1, shadow)
}

/** 칸마다 정해진 의사난수: 같은 등급은 늘 같은 그림이다. */
function hash(a: number, b: number): number {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * 유리 한 장. 불이 켜졌으면 L(왼쪽 위 한 칸은 더 밝고 아래 줄은 그늘), 꺼졌으면 하늘이 비친 유리: 그림 전체에 걸쳐 대각선 반사가 지나간다.
 */
function pane(g: Grid, x: number, y: number, w: number, h: number, lit: boolean) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let ch: string
      if (lit) {
        ch = j === h - 1 && h > 2 ? '4' : i === 0 && j === 0 ? '3' : 'L'
      } else {
        const d = (x + i + y + j) % 30
        ch = d < 2 ? 'W' : d < 7 ? 'Z' : j === h - 1 ? '1' : '2'
      }
      put(g, x + i, y + j, ch)
    }
  }
}

/** 불 켜진 창 안의 우리 사무실: 천장 불빛 아래 책상, 모니터, 일하는 사람. 작은 창은 모니터와 머리만 보인다. */
function office(g: Grid, x: number, y: number, w: number, h: number, seed: number) {
  pane(g, x, y, w, h, true)
  rect(g, x, y, w, 1, '3')
  if (h < 7) {
    if (hash(x, seed) % 3 !== 0) {
      rect(g, x + 2, y + h - 3, 2, 1, 'h')
      rect(g, x + 1, y + h - 2, 4, 1, hash(seed, x) % 2 ? 'c' : 'p')
    }
    return
  }
  const desk = y + h - 2
  rect(g, x, desk, w, 1, 'D')
  for (let i = x + 1; i + 7 <= x + w; i += 7) {
    rect(g, i, desk - 3, 4, 2, 'K')
    rect(g, i + 1, desk - 3, 2, 1, 'Z')
    rect(g, i + 1, desk - 1, 2, 1, 'K')
    if (hash(i, seed) % 4 !== 0) {
      rect(g, i + 5, desk - 5, 2, 1, 'h')
      rect(g, i + 5, desk - 4, 2, 1, 's')
      rect(g, i + 4, desk - 3, 3, 3, hash(seed, i) % 2 ? 'c' : 'p')
    }
  }
}

/** 하늘: 위는 짙고 지평선 쪽은 옅다. 띠 사이는 점을 섞어 잇는다. */
function sky(g: Grid) {
  for (let y = 0; y < GROUND; y++) {
    rect(g, 0, y, W, 1, y < 20 ? 'a' : y < 46 ? 'S' : 'f')
  }
  for (let x = 0; x < W; x += 4) {
    put(g, x, 19, 'S')
    put(g, x + 2, 20, 'a')
    put(g, x, 45, 'f')
    put(g, x + 2, 46, 'S')
  }
}

function cloud(g: Grid, x: number, y: number, w: number) {
  const a = Math.floor(w * 0.45)
  const b = Math.floor(w * 0.3)
  rect(g, x + 3, y + 1, a, 2, 'W')
  rect(g, x + a, y, b, 3, 'W')
  rect(g, x + 1, y + 3, w - 2, 1, 'W')
  rect(g, x, y + 4, w, 1, 'W')
  rect(g, x + 1, y + 5, w - 2, 1, 'i')
  rect(g, x + a + 1, y - 1, b - 2, 1, 'W')
}

/** 먼 도시: 옅은 건물 실루엣이 지평선을 메운다. 큰 건물일수록 도시가 높다. */
function farCity(g: Grid, base: number, seed: number) {
  let x = 0
  let k = seed
  while (x < W) {
    const w = 6 + (hash(k, 1) % 9)
    const h = base + (hash(k, 2) % 12)
    rect(g, x, GROUND - h, w, h, 'j')
    rect(g, x + w - 2, GROUND - h, 2, h, 'q')
    if (hash(k, 3) % 3 === 0) {
      rect(g, x + 2, GROUND - h - 3, 1, 3, 'q')
    }
    x += w + (hash(k, 4) % 3)
    k++
  }
}

/** 이웃 건물(회색). 창마다 반사가 있고 몇 집은 불이 켜져 있다. */
function neighbor(g: Grid, x: number, w: number, top: number, seed: number) {
  bevel(g, x, top + 2, w, GROUND - top - 2, 'C', 'v', 'u')
  rect(g, x + w - 3, top + 3, 2, GROUND - top - 3, 'u')
  rect(g, x - 1, top, w + 2, 1, 'v')
  rect(g, x - 1, top + 1, w + 2, 1, 'u')
  const style = seed % 3
  for (let y = top + 5; y < GROUND - 4; y += style === 1 ? 4 : 5) {
    if (style === 1) {
      rect(g, x + 2, y, w - 6, 2, 'x')
      rect(g, x + 2, y, Math.min(4, w - 6), 1, 'v')
      continue
    }
    for (let i = x + 3; i + 2 < x + w - 3; i += 5) {
      const warm = hash(i + seed, y) % 6 === 0
      rect(g, i, y, 3, style === 0 ? 3 : 2, warm ? 'E' : 'x')
      put(g, i, y, warm ? 'E' : 'v')
    }
  }
  if (seed % 2 === 0 && w > 12) {
    // 옥상 물탱크
    bevel(g, x + 3, top - 4, 6, 4, 'v', 'W', 'u')
  } else {
    rect(g, x + w - 6, top - 6, 1, 6, 'u')
    rect(g, x + w - 8, top - 4, 5, 1, 'u')
  }
}

/** 보도(타일 줄눈)와 연석, 차선이 그려진 찻길 */
function street(g: Grid) {
  rect(g, 0, GROUND, W, 1, '-')
  rect(g, 0, GROUND + 1, W, 3, '+')
  for (let x = 4; x < W; x += 8) {
    rect(g, x, GROUND + 1, 1, 3, '-')
  }
  rect(g, 0, GROUND + 4, W, 1, ':')
  rect(g, 0, GROUND + 5, W, H - GROUND - 5, '=')
  for (let x = 3; x < W; x += 12) {
    rect(g, x, GROUND + 6, 6, 1, 'W')
  }
}

function tree(g: Grid, cx: number) {
  const base = GROUND + 2
  rect(g, cx - 2, base, 6, 1, ':')
  rect(g, cx, base - 9, 2, 9, 'V')
  put(g, cx, base - 6, 'd')
  const cy = base - 14
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 7; dx++) {
      const ex = dx - 0.5
      if (ex * ex + dy * dy * 1.2 <= 40) {
        const s = ex + dy
        const ch = s < -4 ? '&' : s > 4 ? '%' : hash(cx + dx, dy) % 9 === 0 ? '%' : 'g'
        put(g, cx + dx, cy + dy, ch)
      }
    }
  }
}

function lamp(g: Grid, x: number) {
  const base = GROUND + 2
  rect(g, x - 1, base - 1, 3, 1, 'K')
  rect(g, x, base - 18, 1, 17, 'K')
  rect(g, x, base - 18, 4, 1, 'K')
  rect(g, x + 2, base - 18, 4, 2, 'K')
  rect(g, x + 3, base - 16, 2, 1, 'l')
}

/** 화분: 같은 건물 안에서 한 단계 오른 등급의 소품. 입구 옆에 둔다. */
function pot(g: Grid, x: number) {
  rect(g, x, GROUND - 5, 7, 1, 'O')
  rect(g, x + 1, GROUND - 4, 5, 4, 'P')
  rect(g, x + 1, GROUND - 4, 1, 4, 'O')
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy <= 10) {
        const s = dx + dy
        put(g, x + 3 + dx, GROUND - 9 + dy, s < -2 ? '&' : s > 2 ? '%' : 'g')
      }
    }
  }
}

/**
 * 짙은 유리 외벽의 빌딩. 앞면은 층마다 유리창이 늘어서고 오른쪽 옆면은 그늘이다. lit은 우리 회사가 쓰는 층 수(아래부터)이고 그 층의 창은 불이 켜져
 * 있다(L). 나머지 층은 하늘이 비친 유리다.
 */
function glassTower(
  g: Grid,
  x: number,
  w: number,
  top: number,
  bottom: number,
  lit: number | 'all',
  side: number,
) {
  const floorH = 5
  const col = 6
  rect(g, x, top, w, bottom - top, 'K')
  rect(g, x, top, w, 1, '5')
  rect(g, x, top, 1, bottom - top, '5')
  rect(g, x + w, top, side, bottom - top, '6')
  const n = Math.floor((w - 3) / col)
  const left = x + Math.ceil((w - (n * col - 1)) / 2)
  let floor = 0
  for (let y = bottom - floorH; y > top; y -= floorH, floor++) {
    const on = lit === 'all' || floor < lit
    for (let k = 0; k < n; k++) {
      pane(g, left + k * col, y + 1, col - 1, floorH - 1, on)
      if (on && hash(k + x, y) % 6 === 0) {
        // 몇몇 창은 불빛이 더 밝다.
        rect(g, left + k * col, y + 1, col - 1, 2, '3')
      }
    }
    for (let i = x + w + 1; i < x + w + side - 1; i += 3) {
      rect(g, i, y + 1, 2, floorH - 1, on ? '4' : '1')
    }
  }
}

/** 빌딩 1층 로비: 유리벽과 가운데 회전문, 위에 차양 */
function lobby(g: Grid, x: number, w: number, top: number, side: number) {
  rect(g, x, top, w, GROUND - top, 'K')
  rect(g, x, top, 1, GROUND - top, '5')
  rect(g, x + w, top, side, GROUND - top, '6')
  for (let i = x + 2; i + 6 <= x + w - 1; i += 7) {
    pane(g, i, top + 2, 6, GROUND - top - 2, false)
  }
  const cx = x + Math.floor(w / 2)
  rect(g, cx - 6, top + 2, 12, GROUND - top - 2, 'K')
  pane(g, cx - 5, top + 3, 4, GROUND - top - 3, false)
  pane(g, cx + 1, top + 3, 4, GROUND - top - 3, false)
  rect(g, cx - 1, top + 3, 2, GROUND - top - 3, '5')
  rect(g, cx - 10, top, 20, 1, '5')
  rect(g, cx - 10, top + 1, 20, 1, '6')
}

/** 간판 글씨처럼 보이는 짧은 획들 */
function lettering(g: Grid, x: number, y: number, count: number, ch: string) {
  for (let k = 0; k < count; k++) {
    const gx = x + k * 6
    rect(g, gx, y, 4, 1, ch)
    rect(g, gx + (k % 2 ? 3 : 0), y, 1, 3, ch)
    rect(g, gx, y + 2, 4, 1, ch)
    if (k % 3 === 1) {
      put(g, gx + 1, y + 1, ch)
    }
  }
}

/** 오르는 주가 선: 증권사의 표시 */
function chartMark(g: Grid, x: number, y: number, ch: string) {
  const pts = [
    [0, 5],
    [1, 4],
    [2, 4],
    [3, 3],
    [4, 4],
    [5, 3],
    [6, 2],
    [7, 1],
    [8, 0],
  ]
  for (const [dx, dy] of pts) {
    put(g, x + dx, y + dy, ch)
  }
  rect(g, x + 6, y, 3, 1, ch)
  rect(g, x + 8, y, 1, 3, ch)
}

const SCENERY: Record<
  Tier,
  {
    city: number
    clouds: [number, number, number][]
    neighbors: [number, number, number][]
    trees: number[]
    lamps: number[]
  }
> = {
  basement: {
    city: 8,
    clouds: [
      [6, 8, 22],
      [96, 4, 18],
    ],
    neighbors: [
      [0, 22, 42],
      [104, 24, 38],
    ],
    trees: [112],
    lamps: [],
  },
  shop: {
    city: 12,
    clouds: [
      [8, 6, 20],
      [92, 10, 22],
    ],
    neighbors: [
      [0, 22, 28],
      [106, 22, 22],
    ],
    trees: [10],
    lamps: [114],
  },
  small: {
    city: 18,
    clouds: [
      [4, 4, 22],
      [102, 12, 20],
    ],
    neighbors: [
      [0, 28, 30],
      [104, 24, 38],
    ],
    trees: [118],
    lamps: [8],
  },
  yeouido: {
    city: 24,
    clouds: [
      [2, 6, 22],
      [104, 2, 20],
    ],
    neighbors: [
      [0, 30, 22],
      [104, 24, 16],
    ],
    trees: [10, 118],
    lamps: [],
  },
  whole: {
    city: 24,
    clouds: [
      [2, 6, 22],
      [104, 2, 20],
    ],
    neighbors: [
      [0, 30, 22],
      [104, 24, 16],
    ],
    trees: [10, 118],
    lamps: [],
  },
  hq: {
    city: 26,
    clouds: [
      [4, 2, 24],
      [100, 8, 22],
    ],
    neighbors: [
      [0, 14, 24],
      [114, 14, 18],
    ],
    trees: [7],
    lamps: [116],
  },
  landmark: {
    city: 30,
    clouds: [
      [2, 4, 22],
      [100, 6, 24],
    ],
    neighbors: [
      [0, 20, 30],
      [22, 16, 44],
      [96, 14, 40],
      [108, 20, 22],
    ],
    trees: [30, 104],
    lamps: [],
  },
}

/**
 * 등급마다 건물 겉모습 (증권사 육성 설계 8.1절, decisions.md 238번). 우리 회사가 쓰는 층은 창에 불이 켜져 있다(L). bare면 하늘·이웃 건물·길바닥 없이
 * 건물만 그린다(빈 칸은 '.', 투명): 라이벌 박치기 장면(243번)이 건물만 따로 움직인다. 불 켜진 창 글자(L)는 우리 건물에만 쓴다.
 */
export function buildingMap(grade: Grade, bare = false): Grid {
  const g: Grid = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  const tier: Tier = tierOf(grade)
  const scene = SCENERY[tier]
  if (!bare) {
    sky(g)
    for (const [x, y, w] of scene.clouds) {
      cloud(g, x, y, w)
    }
    farCity(g, scene.city, TIER_ORDER.indexOf(tier) * 7)
    scene.neighbors.forEach(([x, w, top], k) => {
      neighbor(g, x, w, top, k + TIER_ORDER.indexOf(tier))
    })
    street(g)
  }
  switch (tier) {
    case 'basement': {
      // 3층 빌라. 우리 회사는 길바닥 높이에 반쯤 묻힌 반지하 창 하나(쇠창살 너머로 불이 켜져 있다).
      // 옥상: 물탱크와 안테나
      rect(g, 46, 8, 1, 14, 'K')
      rect(g, 43, 10, 7, 1, 'K')
      rect(g, 44, 13, 5, 1, 'K')
      bevel(g, 76, 12, 11, 9, '2', 'W', '1')
      rect(g, 77, 15, 9, 1, '1')
      rect(g, 77, 18, 9, 1, '1')
      rect(g, 78, 21, 1, 1, 'K')
      rect(g, 84, 21, 1, 1, 'K')
      // 처마
      rect(g, 34, 22, 60, 1, 'Y')
      rect(g, 34, 23, 60, 2, 'X')
      rect(g, 35, 25, 58, 1, '0')
      // 벽돌 벽
      bevel(g, 38, 26, 52, GROUND - 26, 'M', '9', '8')
      rect(g, 87, 27, 2, GROUND - 27, '8')
      for (let y = 29; y < GROUND; y += 3) {
        rect(g, 39, y, 48, 1, '9')
        for (let x = 41 + ((y / 3) % 2) * 4; x < 87; x += 8) {
          put(g, x, y + 1, '9')
        }
      }
      rect(g, 39, 26, 49, 1, '8')
      // 층마다 창 두 개(가운데 창살, 창턱)
      for (const y of [29, 43, 56]) {
        for (const x of [43, 72]) {
          rect(g, x, y, 13, 9, 'N')
          pane(g, x + 1, y + 1, 5, 7, false)
          pane(g, x + 7, y + 1, 5, 7, false)
          rect(g, x - 1, y + 9, 15, 1, 'F')
          rect(g, x, y + 10, 13, 1, '8')
        }
      }
      // 2층 화단
      rect(g, 43, 51, 13, 2, 'P')
      rect(g, 43, 51, 13, 1, 'O')
      for (let x = 44; x < 55; x += 2) {
        put(g, x, 50, x % 4 ? 'g' : 'R')
      }
      // 현관: 유리 차양, 문, 계단
      rect(g, 57, 54, 14, 1, 'K')
      rect(g, 57, 55, 14, 1, '2')
      bevel(g, 59, 57, 10, GROUND - 57, 'D', 'N', '0')
      pane(g, 61, 59, 2, 7, false)
      pane(g, 65, 59, 2, 7, false)
      put(g, 63, 64, 'y')
      put(g, 64, 64, 'y')
      rect(g, 58, GROUND - 2, 12, 1, '7')
      rect(g, 57, GROUND - 1, 14, 1, 'N')
      // 반지하 창: 보도를 파낸 채광 구멍 안에 반쯤 묻혀 있다.
      if (!bare) {
        rect(g, 40, GROUND, 20, 5, ':')
        rect(g, 41, GROUND, 18, 4, '-')
      }
      bevel(g, 42, 66, 16, 10, 'N', 'F', '8')
      office(g, 43, 67, 14, 8, 1)
      for (let x = 46; x < 57; x += 4) {
        rect(g, x, 67, 1, 8, '6')
      }
      break
    }
    case 'shop': {
      // 2층 상가. 1층은 줄무늬 차양을 친 가게, 2층이 우리 사무실(불 켜짐)과 노란 간판.
      // 옥상 실외기
      bevel(g, 32, 24, 10, 6, 'F', 'W', '7')
      rect(g, 34, 26, 5, 3, 'N')
      bevel(g, 44, 25, 8, 5, 'F', 'W', '7')
      rect(g, 46, 27, 4, 2, 'N')
      rect(g, 84, 22, 1, 8, 'K')
      rect(g, 82, 24, 5, 1, 'K')
      // 벽과 난간
      bevel(g, 26, 32, 76, GROUND - 32, 'H', 'F', '#')
      rect(g, 99, 33, 2, GROUND - 33, '#')
      rect(g, 25, 30, 78, 1, 'F')
      rect(g, 25, 31, 78, 1, 'N')
      // 2층: 우리 사무실
      for (let k = 0; k < 4; k++) {
        const x = 29 + k * 18
        rect(g, x, 35, 16, 13, 'N')
        office(g, x + 1, 36, 14, 11, k)
        rect(g, x - 1, 48, 18, 1, 'F')
        rect(g, x, 49, 16, 1, '#')
      }
      // 노란 간판: 오르는 주가 선과 글씨
      bevel(g, 28, 50, 72, 8, 'y', 'l', 'n')
      rect(g, 28, 58, 72, 1, '#')
      chartMark(g, 33, 51, 'U')
      lettering(g, 47, 52, 6, 'r')
      // 1층 가게의 줄무늬 차양
      rect(g, 27, 59, 74, 1, '%')
      for (let x = 27; x < 101; x++) {
        const c = Math.floor((x - 27) / 4) % 2 === 0 ? 'g' : 'W'
        rect(g, x, 60, 1, 2, c)
        if ((x - 27) % 4 === 1 || (x - 27) % 4 === 2) {
          put(g, x, 62, c)
        }
      }
      // 1층 진열창과 유리문
      rect(g, 28, 63, 72, GROUND - 63, 'N')
      pane(g, 29, 64, 28, 8, false)
      pane(g, 71, 64, 28, 8, false)
      rect(g, 31, 68, 4, 4, 'B')
      rect(g, 36, 67, 3, 5, 'R')
      rect(g, 40, 69, 5, 3, 'y')
      rect(g, 47, 68, 4, 4, 'c')
      rect(g, 74, 69, 6, 3, 'P')
      rect(g, 75, 67, 4, 2, 'g')
      rect(g, 84, 68, 3, 4, 'B')
      rect(g, 89, 69, 6, 3, 'O')
      rect(g, 58, 63, 12, GROUND - 63, 'K')
      pane(g, 59, 64, 4, 8, false)
      pane(g, 65, 64, 4, 8, false)
      rect(g, 63, 67, 1, 2, 'W')
      rect(g, 64, 67, 1, 2, 'W')
      break
    }
    case 'small': {
      // 다섯 층짜리 작은 빌딩. 우리 회사는 로비 바로 위 한 층(불 켜짐).
      // 옥상 계단실·안테나·실외기
      bevel(g, 40, 7, 14, 6, 'F', 'W', '7')
      rect(g, 44, 9, 4, 4, 'D')
      rect(g, 50, 4, 1, 3, 'K')
      rect(g, 48, 5, 5, 1, 'K')
      bevel(g, 70, 9, 7, 4, 'F', 'W', '7')
      rect(g, 71, 10, 3, 2, 'N')
      bevel(g, 79, 9, 7, 4, 'F', 'W', '7')
      rect(g, 80, 10, 3, 2, 'N')
      // 몸통과 옆면
      bevel(g, 34, 14, 56, GROUND - 14, 'F', 'W', '7')
      rect(g, 90, 14, 6, GROUND - 14, '7')
      rect(g, 95, 14, 1, GROUND - 14, 'N')
      rect(g, 33, 12, 58, 1, 'W')
      rect(g, 33, 13, 58, 1, 'N')
      rect(g, 91, 12, 5, 2, 'N')
      for (let f = 0; f < 5; f++) {
        const y = 54 - f * 10
        const lit = f === 0
        rect(g, 37, y + 2, 50, 7, 'N')
        for (let k = 0; k < 6; k++) {
          if (lit) {
            office(g, 38 + k * 8, y + 3, 7, 5, k)
          } else {
            pane(g, 38 + k * 8, y + 3, 7, 5, false)
          }
        }
        rect(g, 36, y + 9, 52, 1, '7')
        rect(g, 91, y + 3, 3, 5, lit ? '4' : '1')
      }
      // 로비: 차양, 유리문, 양옆 유리
      rect(g, 37, 64, 50, GROUND - 64, 'N')
      pane(g, 38, 65, 16, 7, false)
      pane(g, 70, 65, 16, 7, false)
      rect(g, 55, 64, 14, GROUND - 64, 'K')
      pane(g, 56, 66, 5, 6, false)
      pane(g, 63, 66, 5, 6, false)
      rect(g, 52, 63, 20, 1, '5')
      rect(g, 52, 64, 20, 1, 'K')
      break
    }
    case 'yeouido':
    case 'whole': {
      // 여의도 유리 빌딩. 몇 층만 쓰면 아래 네 층에 불이 켜지고, 통째로 쓰면 모든 층에 불이 켜지고 꼭대기에 금빛 간판이 선다.
      const all = tier === 'whole'
      rect(g, 42, 6, 44, 5, 'K')
      rect(g, 86, 6, 6, 5, '6')
      for (const y of [7, 9]) {
        rect(g, 43, y, 42, 1, '5')
      }
      rect(g, 50, 5, 1, 1, 'R')
      glassTower(g, 38, 52, 11, 62, all ? 'all' : 4, 8)
      lobby(g, 38, 52, 62, 8)
      if (all) {
        bevel(g, 44, 4, 40, 7, 'y', 'l', 'n')
        chartMark(g, 48, 5, 'U')
        lettering(g, 60, 6, 4, 'K')
      }
      break
    }
    case 'hq': {
      // 우리 이름이 붙은 사옥: 넓고, 꼭대기에 주가 선을 그린 금빛 로고. 1층은 돌기둥 현관.
      bevel(g, 36, 5, 56, 14, 'K', '5', '6')
      rect(g, 92, 5, 6, 14, '6')
      bevel(g, 40, 7, 48, 10, 'y', 'l', 'n')
      bevel(g, 43, 8, 12, 8, 'W', 'W', 'Z')
      chartMark(g, 44, 9, 'U')
      lettering(g, 58, 10, 5, 'K')
      glassTower(g, 18, 86, 19, 60, 'all', 6)
      for (const x of [18, 46, 74, 102]) {
        rect(g, x, 19, 2, 41, '5')
      }
      // 돌기둥 현관과 계단
      bevel(g, 16, 58, 90, 2, 'W', 'W', '7')
      rect(g, 104, 58, 6, 2, '7')
      rect(g, 18, 60, 86, GROUND - 60, 'K')
      rect(g, 104, 60, 6, GROUND - 60, '6')
      for (let x = 20; x < 100; x += 14) {
        pane(g, x + 4, 61, 10, GROUND - 61, false)
        bevel(g, x, 60, 4, GROUND - 60, 'F', 'W', '7')
      }
      bevel(g, 100, 60, 4, GROUND - 60, 'F', 'W', '7')
      rect(g, 56, 62, 16, GROUND - 62, 'K')
      pane(g, 57, 63, 6, GROUND - 63, false)
      pane(g, 65, 63, 6, GROUND - 63, false)
      rect(g, 54, 61, 20, 1, 'y')
      rect(g, 52, GROUND - 2, 24, 1, '7')
      rect(g, 50, GROUND - 1, 28, 1, 'N')
      break
    }
    case 'landmark': {
      // 랜드마크 타워: 가늘고 높이 솟아 꼭대기에 금빛 왕관과 첨탑. 위로 갈수록 한 번 좁아지고 모서리에 금빛 테가 선다.
      rect(g, 63, 4, 2, 5, 'y')
      rect(g, 63, 4, 1, 4, 'l')
      bevel(g, 56, 9, 16, 6, 'y', 'l', 'n')
      for (let x = 59; x < 70; x += 3) {
        rect(g, x, 11, 1, 3, 'n')
      }
      bevel(g, 48, 15, 32, 6, 'y', 'l', 'n')
      for (let x = 51; x < 78; x += 4) {
        rect(g, x, 17, 2, 3, 'K')
      }
      glassTower(g, 47, 34, 21, 37, 'all', 5)
      glassTower(g, 44, 40, 37, 60, 'all', 6)
      rect(g, 47, 21, 1, 16, 'l')
      rect(g, 80, 21, 1, 16, 'n')
      rect(g, 44, 37, 1, 23, 'l')
      rect(g, 83, 37, 1, 23, 'n')
      rect(g, 44, 37, 46, 1, 'y')
      bevel(g, 36, 60, 56, 2, 'y', 'l', 'n')
      rect(g, 92, 60, 6, 2, 'n')
      lobby(g, 36, 56, 62, 6)
      break
    }
  }
  if (!bare) {
    for (const x of scene.trees) {
      tree(g, x)
    }
    for (const x of scene.lamps) {
      lamp(g, x)
    }
    if (tier === 'basement') {
      // 골목의 전봇대와 전깃줄
      rect(g, 24, 28, 2, GROUND + 2 - 28, 'V')
      rect(g, 19, 32, 12, 1, 'V')
      put(g, 20, 31, 'W')
      put(g, 29, 31, 'W')
      for (let x = 0; x < 20; x++) {
        put(g, x, 32 + Math.round(((20 - x) * x) / 50), 'K')
      }
    }
  }
  if (hasProp(grade)) {
    pot(g, 72)
  }
  return g
}

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
  fill: string
}

/** 그릴 사각형 목록. 가로 띠(toRuns)를 위아래로 같은 띠끼리 다시 묶어 사각형 수를 줄인다. */
export function buildingRects(
  grade: Grade,
  bare = false,
  palette: Record<string, string> = PALETTE,
): PixelRect[] {
  const rects: PixelRect[] = []
  const open = new Map<string, PixelRect>()
  for (const r of toRuns(buildingMap(grade, bare), palette)) {
    const key = `${r.x},${r.width},${r.fill}`
    const above = open.get(key)
    if (above && above.y + above.height === r.y) {
      above.height += 1
    } else {
      const rect = { ...r, height: 1 }
      rects.push(rect)
      open.set(key, rect)
    }
  }
  return rects
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
          {buildingRects(grade).map((r) => (
            <rect
              key={`${r.x}-${r.y}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={r.fill}
            />
          ))}
        </svg>
      )}
      <BuildingLadder tier={tier} />
    </div>
  )
})
