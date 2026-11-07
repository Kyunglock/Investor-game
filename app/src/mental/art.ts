import {
  bakeCat,
  CAT_H,
  CAT_W,
  drawEnemy,
  drawGun,
  GUN_LEN,
  GUN_PIVOT,
  INK,
} from '@web/features/game/cat/draw'
import { BOSS_LOOK } from '@web/features/game/cat/look'
import type Phaser from 'phaser'
import type { EnemyKind } from './enemies'
import type { Genre } from './genres'
import type { Hero } from './hero'

/**
 * 멘탈 전투의 그림 (decisions.md 341번). 그림은 이미지 파일이 아니라 코드다(설계 7.1절): 사장냥·적 넷은 `@web/features/game/cat/draw`의
 * 캔버스 그림을 쓰고, 풀밭·멘탈벽·나무·탄도 같은 규칙(갈색 가는 윤곽, 파스텔 면)으로 캔버스에 그려 Phaser 텍스처로 한 번만 굽는다.
 * 화면 배율(dpr)만큼 크게 구워 흐리지 않다.
 */

/** 텍스처를 구울 때의 화면 배율. 그림 크기(setDisplaySize)는 배율과 상관없이 아래 상수를 쓴다. */
const DPR = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)

/** 사장냥의 화면 크기(px): 상자 100×110의 0.72배. 레퍼런스처럼 화면 높이의 1/12쯤. */
export const HERO_SCALE = 0.72
export const HERO_SIZE = { w: CAT_W * HERO_SCALE, h: CAT_H * HERO_SCALE }
/** 권총: 사장냥 그림의 가운데에서 피벗(손)까지의 거리(px)와 피벗에서 총구까지(px). */
export const GUN = {
  dx: (GUN_PIVOT.x - CAT_W / 2) * HERO_SCALE,
  dy: (GUN_PIVOT.y - CAT_H / 2) * HERO_SCALE,
  len: GUN_LEN * HERO_SCALE,
  /** 총 텍스처(상자 좌표 -8..24 × -8..10)의 원점 비율 */
  ox: 8 / 32,
  oy: 8 / 18,
  w: 32 * HERO_SCALE,
  h: 18 * HERO_SCALE,
}
/** 적 그림(64×64) 안에서 적의 반지름 ≈ 20 × 1.1: 사장냥보다 작다. */
export const ENEMY_SIZE = 64
export const WALL_H = 24

type Painter = (c: CanvasRenderingContext2D) => void

/** 캔버스에 그려 텍스처로 굽는다. 그림 좌표는 w×h(px)이고 배율만큼 크게 그린다. 같은 열쇠가 있으면 건너뛴다. */
function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: Painter) {
  if (scene.textures.exists(key)) {
    return
  }
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(w * DPR)
  cv.height = Math.ceil(h * DPR)
  const c = cv.getContext('2d')
  if (!c) {
    return
  }
  c.scale(DPR, DPR)
  paint(c)
  scene.textures.addCanvas(key, cv)
}

/** 아군 텍스처 열쇠: hero-idle(가만히)·hero-fire(쏘는 중, 눈썹 꾹)·hero-hurt(맞았다, 선글라스가 날아간다). 총은 'gun'으로 따로 돌린다. */
export const HERO_KEYS = ['hero-idle', 'hero-fire', 'hero-hurt'] as const

export function bakeHero(scene: Phaser.Scene, _hero: Hero) {
  const faces = { 'hero-idle': 'boss', 'hero-fire': 'boss', 'hero-hurt': 'hurt' } as const
  for (const key of HERO_KEYS) {
    if (scene.textures.exists(key)) {
      continue
    }
    const cv = bakeCat(
      { ...BOSS_LOOK, face: faces[key], armsForward: key !== 'hero-hurt' },
      HERO_SCALE * DPR,
    )
    if (key === 'hero-hurt') {
      // 날아가는 선글라스
      const c = cv.getContext('2d')
      if (c) {
        c.save()
        c.scale(HERO_SCALE * DPR, HERO_SCALE * DPR)
        c.translate(78, 20)
        c.rotate(0.5)
        c.beginPath()
        c.roundRect(-6, -2.5, 12, 5, 2.5)
        c.fillStyle = '#2a2a33'
        c.fill()
        c.restore()
      }
    }
    scene.textures.addCanvas(key, cv)
  }
  bake(scene, 'gun', GUN.w, GUN.h, (c) => {
    c.scale(HERO_SCALE, HERO_SCALE)
    c.translate(8, 8)
    drawGun(c, BOSS_LOOK.fur)
  })
}

/** 적 텍스처 열쇠: `${kind}-0`·`${kind}-1` 두 프레임(흔들림의 두 순간). */
export function enemyKey(kind: EnemyKind, frame: 0 | 1): string {
  return `${kind}-${frame}`
}

export function bakeEnemies(scene: Phaser.Scene) {
  for (const kind of ['panic', 'dump', 'spec', 'stop'] as const) {
    for (const frame of [0, 1] as const) {
      bake(scene, enemyKey(kind, frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
        c.translate(32, 34)
        c.scale(1.1, 1.1)
        drawEnemy(c, kind, frame ? 0.25 : 0)
      })
    }
  }
}

function tuft(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  c.beginPath()
  c.moveTo(x - 6, y)
  c.quadraticCurveTo(x - 5, y - 8, x - 2, y - 2)
  c.quadraticCurveTo(x, y - 11, x + 2, y - 2)
  c.quadraticCurveTo(x + 5, y - 8, x + 6, y)
  c.closePath()
  c.fillStyle = col
  c.fill()
}

function outlined(c: CanvasRenderingContext2D, col: string, lw = 2.5) {
  c.fillStyle = col
  c.fill()
  c.lineWidth = lw
  c.strokeStyle = INK
  c.lineJoin = 'round'
  c.stroke()
}

/** 바닥·멘탈벽·소품·탄·파편. */
export function bakeStage(scene: Phaser.Scene, genre: Genre) {
  // 바닥: 공격은 풀밭, 디펜스는 마른 풀밭(살굿빛). 64×64 타일에 풀 포기 둘.
  const [base, tuftCol] = genre === 'ASSAULT' ? ['#cfe3a0', '#b4d27f'] : ['#e9dfb0', '#cfc28a']
  bake(scene, `floor-${genre}`, 64, 64, (c) => {
    c.fillStyle = base
    c.fillRect(0, 0, 64, 64)
    tuft(c, 14, 20, tuftCol)
    tuft(c, 46, 52, tuftCol)
  })
  // 멘탈벽: 분홍 벽돌 담(331번). 64×24 타일, 금이 가면 검은 금.
  for (const cracked of [false, true]) {
    bake(scene, cracked ? 'wall-cracked' : 'wall', 64, WALL_H, (c) => {
      c.fillStyle = '#c84f7d'
      c.fillRect(0, 0, 64, WALL_H)
      for (let row = 0; row < 2; row++) {
        const off = row % 2 ? 16 : 0
        for (let x = -32; x < 64; x += 32) {
          c.beginPath()
          c.roundRect(x + off + 1.5, row * 12 + 1.5, 29, 9, 2.5)
          c.fillStyle = '#ff9fc0'
          c.fill()
          c.lineWidth = 2
          c.strokeStyle = INK
          c.stroke()
          c.fillStyle = '#ffd0e0'
          c.fillRect(x + off + 4, row * 12 + 3.5, 10, 2)
        }
      }
      if (cracked) {
        c.beginPath()
        c.moveTo(20, 0)
        c.lineTo(26, 9)
        c.lineTo(22, 16)
        c.lineTo(28, WALL_H)
        c.lineWidth = 2
        c.strokeStyle = INK
        c.stroke()
      }
    })
  }
  // 나무(위쪽 가장자리)와 풀숲(벽 옆) — 장식일 뿐 부딪히지 않는다.
  bake(scene, 'tree', 72, 76, (c) => {
    c.beginPath()
    c.roundRect(31, 52, 10, 20, 3)
    outlined(c, '#a98464', 2)
    for (const [x, y, r] of [
      [22, 40, 20],
      [50, 40, 20],
      [36, 24, 22],
    ]) {
      c.beginPath()
      c.ellipse(x, y, r, r, 0, 0, Math.PI * 2)
      outlined(c, '#8fcf86')
    }
    c.beginPath()
    c.ellipse(28, 18, 6, 4, 0, 0, Math.PI * 2)
    c.fillStyle = 'rgba(255,255,255,.35)'
    c.fill()
  })
  bake(scene, 'bush', 44, 30, (c) => {
    for (const [x, y, r] of [
      [12, 18, 10],
      [32, 18, 10],
      [22, 12, 12],
    ]) {
      c.beginPath()
      c.ellipse(x, y, r, r, 0, 0, Math.PI * 2)
      outlined(c, '#9ed08f')
    }
  })
  // 탄: 주황 빛줄기(+x 방향). 두 프레임은 길이가 조금 다르다.
  for (const look of [0, 1] as const) {
    bake(scene, `bullet-${look}`, 32, 10, (c) => {
      const len = look ? 22 : 26
      c.beginPath()
      c.moveTo(31, 5)
      c.lineTo(31 - len, 1)
      c.lineTo(31 - len, 9)
      c.closePath()
      c.fillStyle = 'rgba(255,170,80,.45)'
      c.fill()
      c.beginPath()
      c.moveTo(31, 5)
      c.lineTo(31 - len * 0.7, 2.5)
      c.lineTo(31 - len * 0.7, 7.5)
      c.closePath()
      c.fillStyle = '#ff8a3d'
      c.fill()
      c.beginPath()
      c.moveTo(29, 5)
      c.lineTo(31 - len * 0.4, 4)
      c.lineTo(31 - len * 0.4, 6)
      c.closePath()
      c.fillStyle = '#fff2c0'
      c.fill()
    })
  }
  // 총구 화염: 노란 별에 흰 심
  bake(scene, 'flash', 24, 24, (c) => {
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 4 : 11
      const a = (i * Math.PI) / 4
      c.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r)
    }
    c.closePath()
    c.fillStyle = '#ffd16b'
    c.fill()
    c.beginPath()
    c.ellipse(12, 12, 3.5, 3.5, 0, 0, Math.PI * 2)
    c.fillStyle = '#fff'
    c.fill()
  })
  // 탄 꼬리·맞은 파편: 작은 둥근 점
  bake(scene, 'trail', 4, 4, (c) => {
    c.beginPath()
    c.ellipse(2, 2, 2, 2, 0, 0, Math.PI * 2)
    c.fillStyle = '#ffb060'
    c.fill()
  })
  bake(scene, 'spark', 4, 4, (c) => {
    c.beginPath()
    c.ellipse(2, 2, 2, 2, 0, 0, Math.PI * 2)
    c.fillStyle = '#ffffff'
    c.fill()
  })
}
