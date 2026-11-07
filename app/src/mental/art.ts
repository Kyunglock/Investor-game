import { viewBody } from '@web/features/game/pixel/bodies'
import { MOODS } from '@web/features/game/pixel/moods'
import { CHARACTER_PALETTE } from '@web/features/game/pixel/palette'
import { area, blob, compose, type Put, type Ramp, toRuns } from '@web/features/game/pixel/sprite'
import { ATTIRE_COLORS, attireOf } from '@web/features/raising/office'
import type Phaser from 'phaser'
import type { EnemyKind } from './enemies'
import type { Genre } from './genres'
import type { Hero } from './hero'

/**
 * 멘탈 전투의 도트 그림 (#423). 그림은 이미지 파일이 아니라 코드다(설계 7.1절): 아군은 사무실의 도트 직원 그대로(32×40, 차림새는 종합 등급), 적 넷과
 * 바닥은 같은 화풍(윤곽·그림자·기본·밝은 쪽, 빛은 왼쪽 위)으로 blob()으로 그린다. 한 칸을 PX픽셀로 키워 캔버스 텍스처에 한 번만 굽는다.
 */

/** 도트 한 칸의 화면 픽셀. */
export const PX = 2

export type Grid = string[][]

/** 적 그림 팔레트. 부위마다 윤곽(1)·그림자(2)·기본(3)·밝은 쪽(4) 네 글자. */
const ENEMY_PALETTE: Record<string, string> = {
  // 패닉셀: 파랑
  '1': '#1b2f5c',
  '2': '#2f58a8',
  '3': '#6fa8f0',
  '4': '#b7d6ff',
  // 투매: 보라 종이 더미
  A: '#3d2a6e',
  B: '#6b4fb3',
  C: '#9a84d9',
  D: '#c8bbee',
  // 투기: 빨강 풍선
  a: '#6e1526',
  b: '#b82a45',
  c: '#f0607b',
  d: '#ffa3b4',
  // 손절매: 회색 몸, 가위 날
  g: '#3b3f47',
  G: '#6f7580',
  h: '#aab1bc',
  H: '#d9dee5',
  i: '#5c6672', // 가위 윤곽
  I: '#aeb9c6', // 가위 날 그림자
  J: '#e6edf4', // 가위 날
  K: '#f8fbff', // 가위 날 반짝
  // 공통
  k: '#111317', // 눈·선
  E: '#ffffff', // 눈 흰자, 종이
  e: '#e9e2ef', // 종이 그림자
  R: '#d6304e', // 종이의 붉은 줄, 화난 눈썹
  m: '#7a1f2e', // 벌린 입
  T: '#7fb6ea', // 식은땀
  W: '#ffffff', // 반짝임
  r: '#ff9bb3', // 볼 홍조
  M: '#5a1420', // 입 안
  _: 'rgba(20, 16, 30, 0.28)', // 그림자
  y: '#f6d873', // 금빛
  Y: '#b8871c',
}

const PANIC: Ramp = { outline: '1', shadow: '2', base: '3', light: '4' }
const DUMP: Ramp = { outline: 'A', shadow: 'B', base: 'C', light: 'D' }
const SPEC: Ramp = { outline: 'a', shadow: 'b', base: 'c', light: 'd' }
const STOP: Ramp = { outline: 'g', shadow: 'G', base: 'h', light: 'H' }
const PAPER: Ramp = { outline: 'A', shadow: 'e', base: 'E', light: 'E' }
const BLADE: Ramp = { outline: 'i', shadow: 'I', base: 'J', light: 'K' }

const SIZE = 32

function empty(rows = SIZE, cols = SIZE): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'))
}

function putOf(grid: Grid): Put {
  return (y, x, ch) => {
    if (grid[y] && x >= 0 && x < grid[y].length) {
      grid[y][x] = ch
    }
  }
}

/** 타원 안의 칸. */
function disc(cy: number, cx: number, ry: number, rx: number): [number, number][] {
  const cells: [number, number][] = []
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((y - cy) / ry) ** 2 + ((x - cx) / rx) ** 2 <= 1) {
        cells.push([y, x])
      }
    }
  }
  return cells
}

function fill(put: Put, y: number, xs: number[], ch: string) {
  for (const x of xs) {
    put(y, x, ch)
  }
}

/** 왕눈이: 검은 테두리 안에 흰자, 색 있는 홍채, 눈동자, 반짝임 둘. dx로 눈동자를 옆으로 흘린다. */
function bigEye(put: Put, y: number, x: number, iris: string, dx = 0) {
  for (const [cy, cx] of disc(y, x, 4.5, 4.5)) {
    put(cy, cx, 'k')
  }
  for (const [cy, cx] of disc(y, x, 3.5, 3.5)) {
    put(cy, cx, 'E')
  }
  for (const [cy, cx] of disc(y + 0.5, x + dx, 2.5, 2.5)) {
    put(cy, cx, iris)
  }
  for (const [cy, cx] of disc(y + 1, x + dx, 1.5, 1.5)) {
    put(cy, cx, 'k')
  }
  put(y - 1, x + dx - 1, 'W')
  put(y - 1, x + dx, 'W')
  put(y + 2, x + dx + 1, 'W')
}

/** 반짝이는 별눈(투기): 금빛 별. */
function starEye(put: Put, y: number, x: number) {
  fill(put, y, [x - 3, x - 2, x - 1, x, x + 1, x + 2, x + 3], 'y')
  for (const dy of [-3, -2, -1, 1, 2, 3]) {
    put(y + dy, x, 'y')
  }
  fill(put, y - 1, [x - 1, x + 1], 'y')
  fill(put, y + 1, [x - 1, x + 1], 'Y')
  put(y + 2, x, 'Y')
  put(y, x + 2, 'Y')
  put(y, x + 3, 'Y')
  put(y - 1, x - 1, 'W')
}

/** 걱정 눈썹: 바깥이 처진 사선(ㅅ 모양의 바깥쪽). dir 1이면 왼눈. */
function worriedBrow(put: Put, y: number, x: number, dir: 1 | -1) {
  put(y + 2, x - dir * 3, 'k')
  put(y + 1, x - dir * 2, 'k')
  put(y + 1, x - dir, 'k')
  put(y, x, 'k')
  put(y, x + dir, 'k')
}

/** 볼 홍조: 가로로 긴 분홍 두 점. */
function blush(put: Put, y: number, lx: number, rx: number) {
  fill(put, y, [lx, lx + 1, lx + 2, rx, rx + 1, rx + 2], 'r')
  fill(put, y + 1, [lx + 1, rx + 1], 'r')
}

/** 벌린 입: 어두운 안쪽에 입술 윤곽. */
function openMouth(put: Put, y: number, x: number, ry: number, rx: number) {
  for (const [cy, cx] of disc(y, x, ry + 1, rx + 1)) {
    put(cy, cx, 'm')
  }
  for (const [cy, cx] of disc(y, x, ry, rx)) {
    put(cy, cx, 'M')
  }
}

/** 땀방울: 위가 뾰족한 물방울에 반짝임. */
function drop(put: Put, y: number, x: number) {
  put(y, x, 'T')
  fill(put, y + 1, [x - 1, x, x + 1], 'T')
  fill(put, y + 2, [x - 1, x, x + 1], 'T')
  put(y + 1, x - 1, 'W')
}

/** 아장아장 발 두 개(윤곽 있음). */
function feet(put: Put, y: number, ramp: Ramp, ox = 0) {
  blob(put, area([y, y + 2], [10 + ox, 14 + ox]), ramp)
  blob(put, area([y, y + 2], [18 + ox, 22 + ox]), ramp)
}

/** 그림자: 발밑의 반투명 타원. 몸보다 먼저 그려 몸이 덮는다. */
function shadow(put: Put, y: number, x: number, rx: number) {
  for (const [cy, cx] of disc(y, x, 1.5, rx)) {
    put(cy, cx, '_')
  }
}

type Painter = (put: Put, frame: 0 | 1) => void

/** 패닉셀: 파란 아기 몸, 왕눈이에 걱정 눈썹, 두 손 번쩍, "으악" 입, 땀. 2프레임은 몸이 흔들리고 눈동자가 돌고 땀이 떨어진다. */
const panic: Painter = (put, frame) => {
  const ox = frame ? 1 : 0
  shadow(put, 29.5, 16, 9)
  // 번쩍 든 팔과 손
  blob(put, area([8, 14], [3 + ox, 5 + ox]), PANIC)
  blob(put, area([8, 14], [26 + ox, 28 + ox]), PANIC)
  blob(put, disc(7, 4 + ox, 2, 2), PANIC)
  blob(put, disc(7, 27 + ox, 2, 2), PANIC)
  blob(put, disc(17, 16 + ox, 10, 10.5), PANIC)
  feet(put, 26, PANIC, ox)
  bigEye(put, 15, 11 + ox, '2', frame ? -1 : 1)
  bigEye(put, 15, 21 + ox, '2', frame ? -1 : 1)
  worriedBrow(put, 7, 11 + ox, 1)
  worriedBrow(put, 7, 21 + ox, -1)
  blush(put, 20, 6 + ox, 23 + ox)
  openMouth(put, 22.5, 16 + ox, 1.5, 2)
  drop(put, frame ? 10 : 8, 29 + ox)
  drop(put, frame ? 4 : 3, 7 + ox)
}

/** 투매: 보라 찹쌀떡이 "매도" 주문지 더미를 이고 있다. 왕눈이·걱정 눈썹·물결 입·식은땀. 2프레임은 종이가 미끄러진다. */
const dump: Painter = (put, frame) => {
  const off = frame ? 1 : 0
  shadow(put, 29.5, 16, 10)
  blob(put, disc(20, 16, 9.5, 10.5), DUMP)
  feet(put, 27, DUMP)
  // 종이 세 장: 윤곽, 흰 바탕, 오른쪽 아래 그림자, 붉은 "매도" 줄과 검은 글줄
  for (const [i, [y, x]] of (
    [
      [2, 6 - off],
      [4, 14 + off],
      [7, 9],
    ] as [number, number][]
  ).entries()) {
    blob(put, area([y, y + 7], [x, x + 10]), PAPER)
    fill(put, y + 2, [x + 2, x + 3, x + 4, x + 5], 'R')
    fill(put, y + 4, [x + 2, x + 3, x + 4, x + 5, x + 6, x + 7], 'k')
    fill(put, y + 5, [x + 2, x + 3, x + 4], i === 2 ? 'R' : 'k')
    put(y + 2, x + 7, 'R')
    put(y + 2, x + 8, 'R')
  }
  bigEye(put, 18, 11, 'B', 0)
  bigEye(put, 18, 21, 'B', 0)
  worriedBrow(put, 11, 11, 1)
  worriedBrow(put, 11, 21, -1)
  blush(put, 23, 6, 23)
  fill(put, 25, [13, 15, 17, 19], 'k')
  fill(put, 26, [14, 16, 18], 'k')
  drop(put, frame ? 13 : 12, 29)
}

/** 투기: 방실방실 웃는 빨간 풍선. 별눈, 큰 반짝임, 볼 홍조, 활짝 웃는 입, 매듭 아래 ₩ 동전. 2프레임은 조금 더 부푼다. */
const spec: Painter = (put, frame) => {
  const r = frame ? 12.5 : 12
  shadow(put, 30.5, 16, 7)
  blob(put, disc(14, 16, r, r), SPEC)
  // 큰 반짝임
  fill(put, 5, [9, 10, 11], 'W')
  fill(put, 6, [8, 9], 'W')
  put(7, 8, 'W')
  put(8, 7, 'W')
  put(9, 7, 'W')
  put(8, 23, 'W')
  starEye(put, 12, 10)
  starEye(put, 12, 22)
  blush(put, 17, 5, 24)
  // 활짝 웃는 입: 안쪽은 어둡고 혀는 분홍
  openMouth(put, 19, 16, 1.5, 4.5)
  fill(put, 21, [14, 15, 16, 17, 18], 'r')
  fill(put, 18, [12, 13, 14, 15, 16, 17, 18, 19, 20], 'k')
  // 매듭과 ₩ 동전
  blob(put, area([26, 27], [15, 17]), SPEC)
  blob(put, disc(29.5, 16, 2.5, 3), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
  put(29, 15, 'Y')
  put(29, 17, 'Y')
  put(30, 16, 'Y')
}

/** 손절매: 그렁그렁한 눈의 회색 몽실이가 가위를 안고 있다. 슬픈 눈썹, 흐르는 눈물, 작은 입. 2프레임은 가위가 벌어진다. */
const stop: Painter = (put, frame) => {
  shadow(put, 29.5, 16, 9)
  blob(put, disc(16, 16, 10, 10.5), STOP)
  feet(put, 26, STOP)
  bigEye(put, 13, 11, 'G', 0)
  bigEye(put, 13, 21, 'G', 0)
  worriedBrow(put, 5, 11, 1)
  worriedBrow(put, 5, 21, -1)
  // 흐르는 눈물
  for (const dy of [0, 1, 2, 3]) {
    put(18 + dy, 8, 'T')
    put(18 + dy, 24, 'T')
  }
  put(19, 8, 'W')
  blush(put, 19, 5, 24)
  fill(put, 21, [14, 15, 17, 18], 'k')
  put(22, 16, 'k')
  // 몸 앞에 안은 가위: 날 둘이 위로 엇갈리고, 손잡이 고리 둘
  const spread = frame ? 1 : 0
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < 9; i++) {
    const lx = 14 - Math.round(i * 0.6) - spread
    const rx = 18 + Math.round(i * 0.6) + spread
    left.push([24 - i, lx], [24 - i, lx + 1])
    right.push([24 - i, rx], [24 - i, rx + 1])
  }
  blob(put, left, BLADE)
  blob(put, right, BLADE)
  blob(put, disc(27, 12 - spread, 2, 2.5), STOP)
  blob(put, disc(27, 20 + spread, 2, 2.5), STOP)
  put(27, 12 - spread, 'g')
  put(27, 20 + spread, 'g')
}

const ENEMY_PAINTERS: Record<EnemyKind, Painter> = { panic, dump, spec, stop }

/** 바닥 타일 한 장(16×16, 폭락장은 32×32). 장르마다 다른 장소: 공격은 객장 카펫, 디펜스는 금고실 철판. */
const FLOOR_PALETTE: Record<string, string> = {
  // 객장 카펫(남색)과 줄눈
  n: '#273352',
  N: '#2d3b5e',
  o: '#344468',
  // 금고실 철판
  s: '#8f969f',
  S: '#a3aab3',
  r: '#6c737c', // 리벳 그림자
  t: '#c7cdd4', // 리벳 밝은 쪽
}

const FLOOR_MAPS: Record<Genre, readonly string[]> = {
  ASSAULT: [
    'NNNNNNNNNNNNNNNN',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnonnnnNnnnonnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NNNNNNNNNNNNNNNN',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
    'NnnnonnnNnnnnonn',
    'NnnnnnnnNnnnnnnn',
    'NnnnnnnnNnnnnnnn',
  ],
  DEFENSE: [
    'rrrrrrrrrrrrrrrr',
    'rSSSSSSSSSSSSSSs',
    'rStsSSSSSSSStsSs',
    'rSsrSSSSSSSSsrSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rSSSSSSSSSSSSSSs',
    'rStsSSSSSSSStsSs',
    'rSsrSSSSSSSSsrSs',
    'rsssssssssssssss',
  ],
}

/** 멘탈벽의 높이(픽셀의 절반: 격자 줄 수 × PX ÷ 2). 전투가 벽 자리를 잡는 데 쓴다. */
export const WALL_H = 12 * PX

/**
 * 멘탈벽 타일 (디펜스, 331번): 가로로 이어 붙이는 분홍빛 벽돌 담. 윗줄은 빛나고 벽돌은 어긋나게 쌓였다. cracked면 멘탈이 반 아래로 떨어져 금이 갔다.
 * 32×24.
 */
function wallGrid(cracked: boolean): Grid {
  const grid = empty(24, 32)
  const put = putOf(grid)
  const brick: Ramp = { outline: 'a', shadow: 'b', base: 'c', light: 'd' }
  // 윗면: 밝은 띠
  for (const x of Array.from({ length: 32 }, (_, i) => i)) {
    put(0, x, 'W')
    put(1, x, 'd')
    put(2, x, 'c')
  }
  // 벽돌 세 줄, 줄마다 반 칸씩 어긋난다
  for (const [row, offset] of [
    [3, 0],
    [10, 8],
    [17, 0],
  ]) {
    for (let x = -16 + offset; x < 32; x += 16) {
      blob(put, area([row, row + 6], [Math.max(0, x), Math.min(31, x + 14)]), brick)
    }
  }
  // 반짝임
  put(5, 4, 'W')
  put(12, 13, 'W')
  put(19, 22, 'W')
  if (cracked) {
    for (const [y, x] of [
      [3, 9],
      [4, 9],
      [5, 10],
      [6, 10],
      [7, 11],
      [8, 11],
      [9, 12],
      [10, 12],
      [11, 13],
      [12, 13],
      [13, 14],
      [14, 14],
      [15, 15],
      [16, 15],
      [17, 16],
      [18, 16],
      [19, 17],
      [20, 17],
      [21, 18],
      [22, 18],
      [23, 19],
      [8, 26],
      [9, 26],
      [10, 27],
      [11, 27],
      [12, 28],
    ]) {
      put(y, x, 'k')
    }
  }
  return grid
}

/** 소품 팔레트: 책상·모니터·전광판·기둥·금괴 상자. */
const PROP_PALETTE: Record<string, string> = {
  ...ENEMY_PALETTE,
  w: '#5a3e2b', // 책상 윤곽
  x: '#8a6240', // 책상 그림자
  z: '#b07f54', // 책상 기본
  Z: '#d3a06f', // 책상 밝은 쪽
  n: '#141a26', // 모니터 테두리
  N: '#1e2a3c', // 모니터 화면
  u: '#3ddc84', // 오르는 선
  U: '#ff5c7a', // 내리는 선
  o: '#2a2f3a', // 전광판 바탕
  O: '#111318', // 전광판 테두리
  P: '#e6e1d6', // 대리석 기둥
  p: '#bdb7aa', // 기둥 그림자
  Q: '#9a9387', // 기둥 윤곽
  V: '#f7f2e8', // 기둥 밝은 쪽
}

const WOOD: Ramp = { outline: 'w', shadow: 'x', base: 'z', light: 'Z' }
const MARBLE: Ramp = { outline: 'Q', shadow: 'p', base: 'P', light: 'V' }
const GOLD: Ramp = { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' }

/** 객장 책상: 모니터 둘에 주가 선(왼쪽은 오르고 오른쪽은 내린다). 32×24. */
function deskGrid(): Grid {
  const grid = empty(24, 32)
  const put = putOf(grid)
  shadow(put, 22.5, 16, 15)
  blob(put, area([12, 21], [1, 30]), WOOD)
  fill(put, 22, [3, 4, 27, 28], 'w')
  for (const mx of [4, 18]) {
    blob(put, area([2, 10], [mx, mx + 9]), { outline: 'n', shadow: 'N', base: 'N', light: 'N' })
    fill(put, 11, [mx + 4, mx + 5], 'n')
    const up = mx === 4
    const ys = up ? [8, 7, 7, 6, 5, 5, 4, 3] : [3, 4, 4, 5, 6, 6, 7, 8]
    ys.forEach((y, i) => {
      put(y, mx + 1 + i, up ? 'u' : 'U')
    })
  }
  return grid
}

/** 전광판 타일(가로로 이어 붙인다): 어두운 바탕에 오르내리는 숫자 줄. 32×8. */
function tickerGrid(): Grid {
  const grid = empty(8, 32)
  const put = putOf(grid)
  for (const [y, x] of area([0, 7], [0, 31])) {
    put(y, x, 'o')
  }
  const all = Array.from({ length: 32 }, (_, i) => i)
  fill(put, 0, all, 'O')
  fill(put, 7, all, 'O')
  for (let x = 1; x < 31; x += 3) {
    const up = ((x - 1) / 3) % 2 === 0
    const c = up ? 'u' : 'U'
    for (const y of [2, 3, 4, 5]) {
      put(y, x, c)
    }
    put(up ? 2 : 5, x + 1, c)
  }
  return grid
}

/** 금고실 기둥: 대리석 기둥 한 개. 16×48. */
function pillarGrid(): Grid {
  const grid = empty(48, 16)
  const put = putOf(grid)
  shadow(put, 46.5, 8, 7)
  blob(put, area([0, 3], [1, 14]), MARBLE)
  blob(put, area([4, 42], [3, 12]), MARBLE)
  blob(put, area([43, 45], [1, 14]), MARBLE)
  for (let y = 6; y < 41; y += 2) {
    put(y, 5, 'p')
    put(y, 10, 'V')
  }
  return grid
}

/** 금괴 상자: 나무 상자에 금괴가 쌓였다. 24×20. */
function crateGrid(): Grid {
  const grid = empty(20, 24)
  const put = putOf(grid)
  shadow(put, 18.5, 12, 11)
  blob(put, area([7, 17], [1, 22]), WOOD)
  fill(
    put,
    12,
    Array.from({ length: 20 }, (_, i) => i + 2),
    'x',
  )
  blob(put, area([4, 7], [3, 9]), GOLD)
  blob(put, area([4, 7], [11, 17]), GOLD)
  blob(put, area([1, 4], [7, 13]), GOLD)
  return grid
}

/** 격자를 캔버스 텍스처로 굽는다. 같은 열쇠가 있으면 그대로 둔다. */
function bake(
  scene: Phaser.Scene,
  key: string,
  grid: Grid,
  palette: Record<string, string>,
  px = PX,
) {
  if (scene.textures.exists(key)) {
    return
  }
  const rows = grid.length
  const cols = grid[0].length
  const tex = scene.textures.createCanvas(key, cols * px, rows * px)
  if (!tex) {
    return
  }
  const g = tex.getContext()
  for (const run of toRuns(grid, palette)) {
    g.fillStyle = run.fill
    g.fillRect(run.x * px, run.y * px, run.width * px, px)
  }
  tex.refresh()
}

/** 아군 텍스처 열쇠: hero-front(가만히)·hero-side·hero-walk(걷기 두 프레임, 오른쪽을 본다)·hero-hurt(맞았다). */
export const HERO_KEYS = ['hero-front', 'hero-side', 'hero-walk', 'hero-hurt'] as const

export function bakeHero(scene: Phaser.Scene, hero: Hero) {
  const palette = {
    ...CHARACTER_PALETTE,
    ...ATTIRE_COLORS[attireOf(hero.grade)],
    _: ENEMY_PALETTE._,
  }
  // 발밑에 그림자 넉 줄을 덧붙인다(32×40 → 32×44). 그림자는 발 뒤에 깔린다.
  const grounded = (grid: Grid): Grid => {
    const out = [...grid.map((r) => [...r]), ...empty(4, 32)]
    const put = putOf(out)
    for (const [y, x] of disc(40.5, 16, 2, 10)) {
      if (out[y]?.[x] === '.') {
        put(y, x, '_')
      }
    }
    return out
  }
  bake(scene, 'hero-front', grounded(compose(viewBody(hero.sex, 'adult', 'front'), [])), palette)
  bake(scene, 'hero-side', grounded(compose(viewBody(hero.sex, 'adult', 'side'), [])), palette)
  bake(scene, 'hero-walk', grounded(compose(viewBody(hero.sex, 'adult', 'walk'), [])), palette)
  bake(
    scene,
    'hero-hurt',
    grounded(compose(viewBody(hero.sex, 'adult', 'front'), [MOODS.despair])),
    palette,
  )
}

/** 적 텍스처 열쇠: `${kind}-0`·`${kind}-1` 두 프레임. */
export function enemyKey(kind: EnemyKind, frame: 0 | 1): string {
  return `${kind}-${frame}`
}

export function bakeEnemies(scene: Phaser.Scene) {
  for (const [kind, paint] of Object.entries(ENEMY_PAINTERS) as [EnemyKind, Painter][]) {
    for (const frame of [0, 1] as const) {
      const grid = empty()
      paint(putOf(grid), frame)
      bake(scene, enemyKey(kind, frame), grid, ENEMY_PALETTE)
    }
  }
}

/** 바닥·멘탈벽·소품·탄·파편. */
export function bakeStage(scene: Phaser.Scene, genre: Genre) {
  bake(
    scene,
    `floor-${genre}`,
    FLOOR_MAPS[genre].map((row) => [...row]),
    FLOOR_PALETTE,
    PX * 2,
  )
  bake(scene, 'wall', wallGrid(false), ENEMY_PALETTE)
  bake(scene, 'wall-cracked', wallGrid(true), ENEMY_PALETTE)
  bake(scene, 'desk', deskGrid(), PROP_PALETTE)
  bake(scene, 'ticker', tickerGrid(), PROP_PALETTE)
  bake(scene, 'pillar', pillarGrid(), PROP_PALETTE)
  bake(scene, 'crate', crateGrid(), PROP_PALETTE)
  // 탄: 빙글 도는 금빛 동전(둥근 면과 얇은 옆면)
  const coin = empty(7, 7)
  blob(putOf(coin), disc(3, 3, 2.5, 2.5), GOLD)
  putOf(coin)(3, 3, 'Y')
  bake(scene, 'bullet-0', coin, ENEMY_PALETTE)
  const edge = empty(7, 7)
  blob(putOf(edge), area([1, 5], [2, 4]), GOLD)
  bake(scene, 'bullet-1', edge, ENEMY_PALETTE)
  // 손절매의 멘탈 탄: 파란 눈물
  const tear = empty(7, 5)
  drop(putOf(tear), 0, 2)
  for (const [y, x] of disc(4, 2, 2, 2)) {
    putOf(tear)(y, x, 'T')
  }
  putOf(tear)(3, 1, 'W')
  bake(scene, 'tear', tear, ENEMY_PALETTE)
  // 파편: 흰 네모 한 칸(색은 적마다 입힌다)
  bake(
    scene,
    'spark',
    [
      ['W', 'W'],
      ['W', 'W'],
    ],
    ENEMY_PALETTE,
  )
}

/** 격자 크기(칸). 캐릭터 32×40, 적 32×32. */
export const HERO_SIZE = { w: 32, h: 40 }
export const ENEMY_SIZE = SIZE
