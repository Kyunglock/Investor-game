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

/** 커다란 동그란 눈: 흰자 위에 2×2 눈동자와 반짝임. dx로 눈동자를 옆으로 흘린다. */
function eye(put: Put, y: number, x: number, dx = 0) {
  for (const [cy, cx] of disc(y, x, 2.5, 2.5)) {
    put(cy, cx, 'E')
  }
  for (const [cy, cx] of disc(y + 0.5, x + dx + 0.5, 1.5, 1.5)) {
    put(cy, cx, 'k')
  }
  put(y, x + dx, 'W')
}

/** 감은 웃는 눈(^ ^). */
function happyEye(put: Put, y: number, x: number) {
  put(y, x, 'k')
  put(y - 1, x - 1, 'k')
  put(y - 1, x + 1, 'k')
  put(y, x - 2, 'k')
  put(y, x + 2, 'k')
}

/** 볼 홍조 두 점. */
function blush(put: Put, y: number, lx: number, rx: number) {
  fill(put, y, [lx, lx + 1, rx, rx + 1], 'r')
}

type Painter = (put: Put, frame: 0 | 1) => void

/** 패닉셀: 동그란 파란 아기 몸에 왕눈이, 두 손을 번쩍 들고 "으악". 식은땀이 톡. 2프레임은 몸이 한 칸 흔들리고 땀이 떨어진다. */
const panic: Painter = (put, frame) => {
  const ox = frame ? 1 : 0
  // 번쩍 든 짧은 팔
  blob(put, area([9, 13], [4 + ox, 6 + ox]), PANIC)
  blob(put, area([9, 13], [26 + ox, 28 + ox]), PANIC)
  blob(put, disc(17, 16 + ox, 9.5, 10), PANIC)
  // 아장아장 발
  blob(put, area([26, 28], [11 + ox, 14 + ox]), PANIC)
  blob(put, area([26, 28], [18 + ox, 21 + ox]), PANIC)
  eye(put, 15, 11 + ox, frame ? -1 : 1)
  eye(put, 15, 21 + ox, frame ? -1 : 1)
  blush(put, 19, 8 + ox, 23 + ox)
  // 조그맣게 벌린 입
  for (const [y, x] of disc(21.5, 16 + ox, 1.5, 1.5)) {
    put(y, x, 'm')
  }
  // 식은땀
  const sy = frame ? 9 : 7
  put(sy, 25 + ox, 'T')
  fill(put, sy + 1, [24 + ox, 25 + ox, 26 + ox], 'T')
  put(sy + 1, 24 + ox, 'W')
  put(sy + 2, 25 + ox, 'T')
}

/** 투매: 보라 찹쌀떡 몸이 매도 주문지를 모자처럼 이고 있다. 걱정 가득한 왕눈이와 물결 입. 2프레임은 종이가 한 칸 미끄러진다. */
const dump: Painter = (put, frame) => {
  const off = frame ? 1 : 0
  blob(put, disc(20, 16, 9, 10), DUMP)
  // 머리에 인 종이 두 장
  for (const [i, [y, x]] of (
    [
      [4, 8 - off],
      [7, 14 + off],
    ] as [number, number][]
  ).entries()) {
    blob(put, area([y, y + 6], [x, x + 9]), PAPER)
    fill(put, y + 2, [x + 2, x + 3, x + 4, x + 5], 'R')
    fill(put, y + 4, [x + 2, x + 3, x + 4, x + 5, x + 6], i ? 'R' : 'k')
  }
  eye(put, 18, 11, 0)
  eye(put, 18, 21, 0)
  blush(put, 22, 8, 23)
  // 물결 입(걱정)
  fill(put, 24, [14, 16, 18], 'k')
  fill(put, 25, [15, 17], 'k')
  // 아장아장 발
  blob(put, area([28, 30], [11, 14]), DUMP)
  blob(put, area([28, 30], [18, 21]), DUMP)
}

/** 투기: 방실방실 웃는 빨간 풍선. 감은 눈(^ ^), 볼 홍조, 하트 입, 매듭 아래 금빛 동전. 2프레임은 조금 더 부푼다. */
const spec: Painter = (put, frame) => {
  const r = frame ? 12 : 11.5
  blob(put, disc(14, 16, r, r), SPEC)
  // 반짝임
  fill(put, 6, [10, 11], 'W')
  put(7, 9, 'W')
  put(8, 9, 'W')
  put(9, 22, 'W')
  happyEye(put, 13, 11)
  happyEye(put, 13, 21)
  blush(put, 16, 7, 23)
  // 작은 하트 입
  fill(put, 17, [14, 15, 17, 18], 'm')
  fill(put, 18, [14, 15, 16, 17, 18], 'm')
  fill(put, 19, [15, 16, 17], 'm')
  put(20, 16, 'm')
  // 매듭과 동전
  blob(put, area([26, 27], [15, 17]), SPEC)
  blob(put, area([28, 31], [14, 18]), { outline: 'Y', shadow: 'Y', base: 'y', light: 'W' })
}

/** 손절매: 그렁그렁한 눈의 회색 몽실이가 가위를 꼭 안고 있다. 2프레임은 가위가 조금 벌어진다. */
const stop: Painter = (put, frame) => {
  blob(put, disc(16, 16, 10, 10.5), STOP)
  // 아장아장 발
  blob(put, area([26, 28], [11, 14]), STOP)
  blob(put, area([26, 28], [18, 21]), STOP)
  eye(put, 13, 11, 0)
  eye(put, 13, 21, 0)
  // 그렁그렁한 눈물
  put(16, 9, 'T')
  put(17, 9, 'T')
  put(16, 23, 'T')
  put(17, 23, 'T')
  blush(put, 17, 7, 24)
  // 작은 입 (~)
  fill(put, 19, [14, 15, 17, 18], 'k')
  put(20, 16, 'k')
  // 몸 앞에 꼭 안은 작은 가위
  const spread = frame ? 1 : 0
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < 7; i++) {
    left.push([19 + i, 13 - i * 0.5 - spread] as [number, number])
    right.push([19 + i, 19 + i * 0.5 + spread] as [number, number])
  }
  blob(
    put,
    left.map(([y, x]) => [y, Math.round(x)]),
    BLADE,
  )
  blob(
    put,
    right.map(([y, x]) => [y, Math.round(x)]),
    BLADE,
  )
  blob(put, disc(27, 11 - spread, 1.5, 2), STOP)
  blob(put, disc(27, 21 + spread, 1.5, 2), STOP)
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
