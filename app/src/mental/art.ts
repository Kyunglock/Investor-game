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
  '3': '#5b93e6',
  '4': '#9cc4ff',
  // 투매: 보라 종이 더미
  A: '#3d2a6e',
  B: '#6b4fb3',
  C: '#9a84d9',
  D: '#c8bbee',
  // 투기: 빨강 풍선
  a: '#6e1526',
  b: '#b82a45',
  c: '#ea4d6a',
  d: '#ff8fa3',
  // 손절매: 회색 몸, 가위 날
  g: '#3b3f47',
  G: '#6f7580',
  h: '#9ba2ad',
  H: '#ccd2da',
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

/** 동그란 흰자에 검은 눈동자. dx로 눈동자를 옆으로 흘린다. */
function eye(put: Put, y: number, x: number, dx = 0, big = false) {
  const r = big ? 2 : 1
  for (const [cy, cx] of disc(y, x, r + 0.5, r + 0.5)) {
    put(cy, cx, 'E')
  }
  put(y, x + dx, 'k')
  if (big) {
    put(y + 1, x + dx, 'k')
    put(y, x + dx + 1, 'k')
    put(y + 1, x + dx + 1, 'k')
    put(y, x + dx, 'W')
  }
}

/** 화난 눈썹: 가운데로 내려오는 사선. */
function brow(put: Put, y: number, x: number, dir: 1 | -1) {
  put(y, x, 'k')
  put(y + 1, x + dir, 'k')
  put(y + 1, x + dir * 2, 'k')
}

type Painter = (put: Put, frame: 0 | 1) => void

/** 패닉셀: 작고 동그란 파란 몸, 튀어나올 듯한 눈, 식은땀, 떨리는 다리. 2프레임은 몸이 한 칸 흔들리고 땀이 떨어진다. */
const panic: Painter = (put, frame) => {
  const ox = frame ? 1 : 0
  blob(put, disc(17, 16 + ox, 8, 8.5), PANIC)
  // 다리
  blob(put, area([25, 28], [11 + ox, 13 + ox]), PANIC)
  blob(put, area([25, 28], [19 + ox, 21 + ox]), PANIC)
  eye(put, 15, 12 + ox, frame ? -1 : 1, true)
  eye(put, 15, 20 + ox, frame ? -1 : 1, true)
  // 벌린 입(비명)
  for (const [y, x] of disc(21, 16 + ox, 2, 2.5)) {
    put(y, x, 'm')
  }
  put(20, 16 + ox, 'E')
  // 식은땀
  const sy = frame ? 10 : 8
  put(sy, 26, 'T')
  fill(put, sy + 1, [25, 26, 27], 'T')
  put(sy + 1, 25, 'W')
  put(sy + 2, 26, 'T')
  put(sy - 2, 5, 'T')
  put(sy - 1, 5, 'T')
}

/** 투매: 쏟아지는 매도 주문지 더미. 보라 몸통 위에 흰 종이 세 장이 어긋나게 겹치고 붉은 줄이 그어져 있다. 2프레임은 종이가 한 칸 미끄러진다. */
const dump: Painter = (put, frame) => {
  blob(put, disc(19, 16, 9, 9.5), DUMP)
  const off = frame ? 1 : 0
  for (const [i, [y, x]] of (
    [
      [6, 10 - off],
      [9, 14 + off],
      [12, 9],
    ] as [number, number][]
  ).entries()) {
    blob(put, area([y, y + 8], [x, x + 11]), PAPER)
    for (const ly of [y + 2, y + 4, y + 6]) {
      fill(put, ly, [x + 2, x + 3, x + 4, x + 5, x + 6], i === 2 ? 'R' : 'k')
    }
    fill(put, y + 2, [x + 8, x + 9], 'R')
  }
  brow(put, 21, 11, 1)
  brow(put, 21, 21, -1)
  eye(put, 24, 12, 0)
  eye(put, 24, 20, 0)
  fill(put, 27, [14, 15, 16, 17, 18], 'k')
}

/** 투기: 한껏 부푼 빨간 풍선. 매듭 아래에 금빛 동전이 달렸다. 탐욕스런 반달눈과 활짝 벌린 입. 2프레임은 조금 더 부푼다. */
const spec: Painter = (put, frame) => {
  const r = frame ? 12 : 11.5
  blob(put, disc(14, 16, r, r), SPEC)
  // 반짝임
  fill(put, 6, [10, 11], 'W')
  put(7, 9, 'W')
  put(8, 9, 'W')
  // 매듭과 동전
  blob(put, area([26, 27], [15, 17]), SPEC)
  blob(put, area([28, 31], [14, 18]), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
  // 탐욕: 아래로 처진 반달눈($ 느낌)
  fill(put, 11, [9, 10, 11, 12, 19, 20, 21, 22], 'k')
  fill(put, 12, [9, 12, 19, 22], 'k')
  fill(put, 12, [10, 11, 20, 21], 'y')
  // 활짝 벌린 입
  for (const [y, x] of disc(17, 16, 2.5, 5)) {
    put(y, x, 'm')
  }
  fill(put, 15, [12, 13, 14, 15, 16, 17, 18, 19, 20], 'k')
  fill(put, 16, [13, 14, 15, 16, 17, 18, 19], 'E')
}

/** 손절매: 회색 몸에 큰 가위를 들었다. 날 두 개가 머리 위에서 엇갈린다. 2프레임은 가위가 벌어진다. */
const stop: Painter = (put, frame) => {
  blob(put, disc(21, 16, 7, 8), STOP)
  // 가위 날 둘(엇갈림). frame 1이면 더 벌어진다
  const spread = frame ? 2 : 0
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < 11; i++) {
    const w = i < 3 ? 1 : i < 8 ? 2 : 1
    for (let k = 0; k < w; k++) {
      left.push([3 + i, 9 + i - spread + k])
      right.push([3 + i, 22 - i + spread + k])
    }
  }
  blob(put, left, BLADE)
  blob(put, right, BLADE)
  // 손잡이 고리
  blob(put, disc(16, 11 - spread, 2, 2.5), { outline: 'g', shadow: 'G', base: 'h', light: 'H' })
  blob(put, disc(16, 21 + spread, 2, 2.5), { outline: 'g', shadow: 'G', base: 'h', light: 'H' })
  // 가는 눈과 꾹 다문 입
  fill(put, 20, [11, 12, 13, 19, 20, 21], 'k')
  fill(put, 21, [12, 20], 'E')
  fill(put, 24, [13, 14, 15, 16, 17, 18, 19], 'k')
  brow(put, 18, 10, 1)
  brow(put, 18, 22, -1)
}

const ENEMY_PAINTERS: Record<EnemyKind, Painter> = { panic, dump, spec, stop }

/** 바닥 타일 한 장(16×16, 폭락장은 32×32). 장르마다 다른 장소: 공격은 객장 카펫, 디펜스는 금고실 철판, 생존은 금이 간 폭락장 바닥. */
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
  // 폭락장: 바랜 주황 바닥과 붉은 금
  p: '#e8c79a',
  P: '#dcb987',
  q: '#b9412f',
  Q: '#8e2b22',
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
  SURVIVAL: [
    'pppppppppppppppppppPpppppppppppp',
    'ppPppppppppppppppppppppppppppppp',
    'ppppppppppppQqppppppppppppppPppp',
    'pppppppppppQqppppppppppppppppppp',
    'ppppppppppQqpppppppppPpppppppppp',
    'pppppppppQqppppppppppppppppppppp',
    'ppppppppQqpppQqppppppppppppppppp',
    'pppppppQqpppQqpppppppppppppppppp',
    'ppppppQqQqqQqppppppppppppPpppppp',
    'pppppQqppQqqpppppppppppppppppppp',
    'ppppQqppppQqpppppppppppppppppppp',
    'pppQqppppppQqppppppppppppppppppp',
    'ppQqpppppppQqpppppppppppppppppqQ',
    'pQqpppppppppQqppppppppppppppppQq',
    'Qqppppppppppppppppppppppppppppqp',
    'pppppppppppppppppppPpppppppppQqp',
    'pppppppppppppppppppppppppppQqppp',
    'ppppppPppppppppppppppppppQqppppp',
    'ppppppppppppppppppppppppQqpppppp',
    'pppppppppppppppppppppppQqppppppp',
    'pppppppppppppppppppppQqpppppppPp',
    'ppppppppppppppppppQqQqpppppppppp',
    'pppppppppppppppppQqqQqpppppppppp',
    'ppppPpppppppppppQqpppQqppppppppp',
    'pppppppppppppppQqppppppQqpppPppp',
    'ppppppppppppppQqppppppppQqpppppp',
    'pppppppppppppQqppppppppppQqppppp',
    'ppppppppppppQqpppppppppppppppppp',
    'pppppppppppppppppppppppppppppppp',
    'ppPppppppppppppppppppppppppppppp',
    'ppppppppppppppppppppppPppppppppp',
    'pppppppppppppppppppppppppppppppp',
  ],
}

/** 금고 (디펜스): 회색 철제 금고, 금빛 다이얼과 손잡이. */
function vaultGrid(): Grid {
  const grid = empty(32, 32)
  const put = putOf(grid)
  blob(put, area([4, 29], [4, 27]), STOP)
  blob(put, area([7, 26], [7, 24]), { outline: 'G', shadow: 'G', base: 'h', light: 'H' })
  blob(put, disc(16, 16, 4, 4), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
  put(16, 16, 'g')
  put(13, 16, 'g')
  put(19, 16, 'g')
  put(16, 13, 'g')
  put(16, 19, 'g')
  blob(put, area([12, 20], [25, 26]), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
  fill(put, 30, [8, 9, 22, 23], 'g')
  fill(put, 31, [8, 9, 22, 23], 'g')
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
  const palette = { ...CHARACTER_PALETTE, ...ATTIRE_COLORS[attireOf(hero.grade)] }
  bake(scene, 'hero-front', compose(viewBody(hero.sex, 'adult', 'front'), []), palette)
  bake(scene, 'hero-side', compose(viewBody(hero.sex, 'adult', 'side'), []), palette)
  bake(scene, 'hero-walk', compose(viewBody(hero.sex, 'adult', 'walk'), []), palette)
  bake(scene, 'hero-hurt', compose(viewBody(hero.sex, 'adult', 'front'), [MOODS.despair]), palette)
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

/** 바닥·금고·탄·파편. */
export function bakeStage(scene: Phaser.Scene, genre: Genre) {
  bake(
    scene,
    `floor-${genre}`,
    FLOOR_MAPS[genre].map((row) => [...row]),
    FLOOR_PALETTE,
    PX * 2,
  )
  bake(scene, 'vault', vaultGrid(), ENEMY_PALETTE)
  // 탄: 금빛 동전 한 닢
  const bullet = empty(6, 6)
  blob(putOf(bullet), disc(2.5, 2.5, 2, 2), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
  bake(scene, 'bullet', bullet, ENEMY_PALETTE)
  // 손절매의 멘탈 탄: 파란 눈물
  const tear = empty(7, 5)
  const tp = putOf(tear)
  tp(0, 2, 'T')
  fill(tp, 1, [1, 2, 3], 'T')
  for (const [y, x] of disc(4, 2, 2, 2)) {
    tp(y, x, 'T')
  }
  tp(3, 1, 'W')
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
