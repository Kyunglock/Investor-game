import { CAT_H, CAT_W, GUN_LEN } from '@web/features/game/cat/draw'
import { BOSS_LOOK } from '@web/features/game/cat/look'
import type Phaser from 'phaser'
import { drawStageGun } from './drawStageGun'
import type { EnemyKind } from './enemies'
import { WALK_FRAMES, walkPose } from './enemyWalk'
import type { Genre } from './genres'
import type { Hero } from './hero'
import { MATE_LOOKS } from './mates'
import { drawMentalWall, drawSprite } from './stageArt'

/** 승인한 캐주얼 시안의 투명 스프라이트를 Phaser 텍스처로 굽고, 무기·벽·탄환을 실시간 상태에 맞춰 합성한다. */

/** 화면 배율. 텍스처를 이만큼 크게 굽고 캔버스도 이만큼 크다(battle.ts). 그림 크기(setDisplaySize)는 배율과 상관없이 아래 상수(CSS px)를 쓴다. */
export const DPR = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)

/** 사장냥의 화면 크기(px): 상자 100×110의 0.72배. 레퍼런스처럼 화면 높이의 1/12쯤. */
export const HERO_SCALE = 0.72
export const HERO_SIZE = { w: CAT_W * HERO_SCALE, h: CAT_H * HERO_SCALE }
/** 권총을 사장냥 상자 좌표보다 이만큼 크게 그린다(344번): 전에는 작아서 안 보였다. 앞발도 같이 커져 꼭 쥔 느낌이다. */
const GUN_K = 1.55
/** 권총: 사장냥 그림의 가운데에서 피벗(뒷손)까지의 거리(px)와 피벗에서 총구까지(px). */
export const GUN = {
  dx: 8,
  dy: 10,
  len: GUN_LEN * HERO_SCALE * GUN_K,
  /** 총 텍스처(상자 좌표 -8..26 × -8..14)의 원점 비율 */
  ox: 8 / 34,
  oy: 8 / 22,
  w: 34 * HERO_SCALE * GUN_K,
  h: 22 * HERO_SCALE * GUN_K,
}
/** 적 그림(64×64) 안에서 적의 반지름 ≈ 20 × 1.1. 화면에서는 battle.ts의 ENEMY_SCALE만큼 줄여 사장냥보다 작다(344번). */
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

/** 아군 텍스처 열쇠: hero-idle(가만히)·hero-fire(쏘는 중)·hero-hurt(직접 피격 색상). 총은 'gun'으로 따로 돌린다. */
export const HERO_KEYS = ['hero-idle', 'hero-fire', 'hero-hurt'] as const

export function bakeHero(scene: Phaser.Scene, hero: Hero) {
  const source = scene.textures.get('art-hero').getSourceImage() as HTMLImageElement
  for (const key of HERO_KEYS) {
    bake(scene, key, CAT_W, CAT_H, (c) => {
      c.fillStyle = '#4f8a7133'
      c.beginPath()
      c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
      c.fill()
      drawSprite(
        c,
        source,
        { x: 0, y: 0, w: source.width, h: source.height },
        { x: 14, y: 3, w: 75, h: 100 },
      )
      if (key === 'hero-hurt') {
        c.globalCompositeOperation = 'source-atop'
        c.fillStyle = '#fc795e33'
        c.fillRect(0, 0, CAT_W, CAT_H)
      }
    })
  }
  bake(scene, 'gun', GUN.w, GUN.h, (c) => {
    c.scale(HERO_SCALE * GUN_K, HERO_SCALE * GUN_K)
    c.translate(8, 8)
    drawStageGun(c, BOSS_LOOK.fur, hero.weapon.kind, hero.weapon.grade)
  })
}

/** 함께 싸우는 고양이 i번의 텍스처 열쇠: 몸과 (같은 무기를 쥔) 앞발. */
export const mateKey = (i: number) => `mate-${i}`
export const mateGunKey = (i: number) => `mate-${i}-gun`

/**
 * 그린 것에 색을 'color'로 섞는다(393번): 밝기는 두고 빛깔만 바꿔 윤곽·눈은 그대로, 털만 다른 색 고양이가 된다. 섞으면 투명한 곳까지 칠해지니 원래 그림의
 * 모양으로 다시 오린다. 'color' 섞기는 캔버스 2D에서 어디서나 된다(필터와 달리).
 */
function recolor(c: CanvasRenderingContext2D, w: number, h: number, color: string, paint: Painter) {
  const make = () => {
    const cv = document.createElement('canvas')
    cv.width = Math.ceil(w * DPR)
    cv.height = Math.ceil(h * DPR)
    return cv
  }
  const art = make()
  const g = art.getContext('2d')
  const shape = make()
  const m = shape.getContext('2d')
  if (!g || !m) return
  g.scale(DPR, DPR)
  paint(g)
  m.drawImage(art, 0, 0)
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'color'
  g.globalAlpha = 0.85
  g.fillStyle = color
  g.fillRect(0, 0, art.width, art.height)
  g.globalAlpha = 1
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(shape, 0, 0)
  c.drawImage(art, 0, 0, w, h)
}

/** 한 색에 recolor와 같은 섞기를 한 결과 색: 앞발을 털과 같은 색으로 칠할 때 쓴다. */
function mixed(base: string, color: string): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const g = cv.getContext('2d', { willReadFrequently: true })
  if (!g) return base
  g.fillStyle = base
  g.fillRect(0, 0, 1, 1)
  g.globalCompositeOperation = 'color'
  g.globalAlpha = 0.85
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${gr}, ${b})`
}

/** 사장냥과 똑같은 고양이를 색만 바꿔 굽는다(393번). 든 무기도 같고, 무기를 쥔 앞발은 그 고양이 털 색이다. */
export function bakeMates(scene: Phaser.Scene, hero: Hero) {
  const source = scene.textures.get('art-hero').getSourceImage() as HTMLImageElement
  for (const [i, look] of MATE_LOOKS.entries()) {
    bake(scene, mateKey(i), CAT_W, CAT_H, (c) => {
      c.fillStyle = '#4f8a7133'
      c.beginPath()
      c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
      c.fill()
      recolor(c, CAT_W, CAT_H, look.color, (g) =>
        drawSprite(
          g,
          source,
          { x: 0, y: 0, w: source.width, h: source.height },
          { x: 14, y: 3, w: 75, h: 100 },
        ),
      )
    })
    bake(scene, mateGunKey(i), GUN.w, GUN.h, (c) => {
      // 총은 사장냥 것과 같고, 쥔 앞발만 고양이 털 색이다.
      c.scale(HERO_SCALE * GUN_K, HERO_SCALE * GUN_K)
      c.translate(8, 8)
      drawStageGun(c, mixed(BOSS_LOOK.fur, look.color), hero.weapon.kind, hero.weapon.grade)
    })
  }
}

/** 고정된 크기의 8프레임 보행. 그림만 변형하고 충돌 원은 유지한다. */
export function enemyKey(kind: EnemyKind, frame: number): string {
  return `${kind}-${frame}`
}

export function bakeEnemies(scene: Phaser.Scene) {
  const source = scene.textures.get('art-enemies').getSourceImage() as HTMLImageElement
  const kinds = ['panic', 'dump', 'spec', 'stop'] as const
  for (const [i, kind] of kinds.entries()) {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = ENEMY_SIZE * DPR
    const paint = sprite.getContext('2d')
    if (!paint) continue
    paint.scale(DPR, DPR)
    const size = kind === 'spec' ? 55 : kind === 'panic' ? 43 : 49
    drawSprite(
      paint,
      source,
      {
        x: ((i % 2) * source.width) / 2,
        y: (Math.floor(i / 2) * source.height) / 2,
        w: source.width / 2,
        h: source.height / 2,
      },
      { x: 32 - size / 2, y: 32 - size / 2, w: size, h: size },
    )
    for (let frame = 0; frame < WALK_FRAMES; frame++) {
      bake(scene, enemyKey(kind, frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
        const pose = walkPose(kind, frame)
        c.fillStyle = '#477c6533'
        c.beginPath()
        c.ellipse(32, 55, 19 * pose.shadow, 4 * pose.shadow, 0, 0, Math.PI * 2)
        c.fill()
        c.save()
        c.translate(32, 48 + pose.bob)
        c.rotate(pose.tilt)
        c.scale(1 / pose.squash, pose.squash)
        c.translate(-32, -48)
        // 발목 위는 한 장으로, 아래는 좌우를 나눠 늘리고 접는다.
        // 경계의 시작점은 고정이므로 몸통과 발 사이가 벌어지지 않는다.
        const ankle = kind === 'spec' ? 48 : 46
        c.drawImage(sprite, 0, 0, 64 * DPR, ankle * DPR, 0, 0, 64, ankle)
        for (const [side, step] of [pose.leftFoot, pose.rightFoot].entries()) {
          c.drawImage(
            sprite,
            side * 32 * DPR,
            ankle * DPR,
            32 * DPR,
            (64 - ankle) * DPR,
            side * 32,
            ankle,
            32,
            (64 - ankle) * (1 + step),
          )
        }
        c.restore()
      })
    }
  }
}

/** 멘탈벽과 탄환은 실제 상태에 맞춰 게임 안에서 그린다. */
export function bakeStage(scene: Phaser.Scene, _genre: Genre) {
  for (const cracked of [false, true]) {
    bake(scene, cracked ? 'wall-cracked' : 'wall', 512, 96, (c) => drawMentalWall(c, cracked))
  }
  bake(scene, 'wall-ripple', 80, 50, (c) => {
    for (const r of [15, 25, 36]) {
      c.beginPath()
      c.ellipse(40, 25, r, r * 0.6, 0, 0, Math.PI * 2)
      c.strokeStyle = '#ffd88b'
      c.lineWidth = 2.5
      c.stroke()
    }
  })
  for (const look of [0, 1] as const) {
    bake(scene, `bullet-${look}`, 32, 10, (c) => {
      c.fillStyle = '#ffe29a77'
      c.beginPath()
      c.moveTo(3, 5)
      c.lineTo(20, 2)
      c.lineTo(20, 8)
      c.closePath()
      c.fill()
      c.beginPath()
      c.roundRect(12, 1.2, look ? 15 : 17, 7.6, 3.8)
      c.fillStyle = '#fff6cc'
      c.fill()
      c.strokeStyle = '#eba839'
      c.lineWidth = 1.7
      c.stroke()
    })
  }
  bake(scene, 'bullet-impact', 80, 80, (c) => {
    c.beginPath()
    c.arc(40, 40, 33, 0, Math.PI * 2)
    c.strokeStyle = '#ffac50'
    c.lineWidth = 4
    c.stroke()
    c.beginPath()
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10
      const r = i % 2 ? 12 : 28
      c.lineTo(40 + Math.cos(a) * r, 40 + Math.sin(a) * r)
    }
    c.closePath()
    c.fillStyle = '#ffd56b'
    c.fill()
    c.beginPath()
    c.arc(40, 40, 12, 0, Math.PI * 2)
    c.fillStyle = '#fff9df'
    c.fill()
  })
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

/**
 * 마법 그림 (decisions.md 392번): 물방울·물결·불덩이·불기둥·충격파 고리·부드러운 빛. 색은 흰빛에 가깝게 구워 두고 화면에서 물들이거나(tint) 더해(ADD)
 * 빛나게 한다. 번개 줄기는 매번 모양이 달라 Graphics로 그린다(battle.ts).
 */
export function bakeMagic(scene: Phaser.Scene) {
  const radial = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    stops: string[],
  ) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    for (const [i, color] of stops.entries()) g.addColorStop(i / (stops.length - 1), color)
    return g
  }
  bake(scene, 'magic-soft', 12, 12, (c) => {
    c.fillStyle = radial(c, 6, 6, 6, ['#ffffff', '#ffffffaa', '#ffffff00'])
    c.fillRect(0, 0, 12, 12)
  })
  bake(scene, 'magic-glow', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, ['#ffffff', '#ffffff88', '#ffffff22', '#ffffff00'])
    c.fillRect(0, 0, 64, 64)
  })
  // 물방울: 오른쪽(나아가는 쪽)이 둥글고 왼쪽으로 꼬리가 빠진다.
  bake(scene, 'magic-drop', 32, 20, (c) => {
    c.beginPath()
    c.moveTo(1, 10)
    c.quadraticCurveTo(12, 3, 22, 2.5)
    c.arc(22, 10, 7.5, -Math.PI / 2, Math.PI / 2)
    c.quadraticCurveTo(12, 17, 1, 10)
    const g = c.createLinearGradient(0, 0, 32, 0)
    g.addColorStop(0, '#9fdcff00')
    g.addColorStop(0.45, '#7fcbff')
    g.addColorStop(1, '#2f8fe8')
    c.fillStyle = g
    c.fill()
    c.strokeStyle = '#e8f7ff'
    c.lineWidth = 1.2
    c.stroke()
    c.beginPath()
    c.ellipse(24, 7, 2.6, 1.6, -0.4, 0, Math.PI * 2)
    c.fillStyle = '#ffffff'
    c.fill()
  })
  // 큰 물결: 오른쪽(나아가는 쪽)으로 부푼 초승달. 앞은 흰 거품, 뒤로 갈수록 옅은 파랑.
  bake(scene, 'magic-wave', 44, 120, (c) => {
    c.beginPath()
    c.arc(-46, 60, 84, -0.82, 0.82)
    c.arc(-76, 60, 84, 0.9, -0.9, true)
    c.closePath()
    const g = c.createLinearGradient(0, 0, 44, 0)
    g.addColorStop(0, '#3fa2f000')
    g.addColorStop(0.3, '#3f9ff0cc')
    g.addColorStop(0.8, '#9fe0ff')
    g.addColorStop(1, '#ffffff')
    c.fillStyle = g
    c.fill()
    c.strokeStyle = '#ffffffdd'
    c.lineWidth = 2
    c.beginPath()
    c.arc(-46, 60, 84, -0.78, 0.78)
    c.stroke()
  })
  // 불덩이: 흰 심 → 노랑 → 주황 → 빨강으로 번진다.
  bake(scene, 'magic-ember', 28, 28, (c) => {
    c.fillStyle = radial(c, 14, 14, 14, ['#ffffff', '#fff2a0', '#ffb340', '#ff5a1f', '#d9261a00'])
    c.fillRect(0, 0, 28, 28)
  })
  // 불기둥: 아래가 하얗게 뜨겁고 위로 갈수록 빨갛게 사라지는 일렁이는 기둥. 원점은 아래 가운데.
  bake(scene, 'magic-pillar', 48, 140, (c) => {
    c.beginPath()
    c.moveTo(6, 140)
    for (let y = 140; y >= 0; y -= 14) c.lineTo(8 + (140 - y) * 0.09 + Math.sin(y / 9) * 3, y)
    for (let y = 0; y <= 140; y += 14) c.lineTo(40 - (140 - y) * 0.09 + Math.sin(y / 7) * 3, y)
    c.closePath()
    const g = c.createLinearGradient(0, 140, 0, 0)
    g.addColorStop(0, '#fffbe0')
    g.addColorStop(0.25, '#ffd24d')
    g.addColorStop(0.6, '#ff7a26cc')
    g.addColorStop(1, '#d9261a00')
    c.fillStyle = g
    c.fill()
  })
  // 탄 자리: 바닥에 깔리는 납작한 불빛.
  bake(scene, 'magic-scorch', 80, 44, (c) => {
    c.save()
    c.scale(1, 44 / 80)
    c.fillStyle = radial(c, 40, 40, 40, ['#fff0a0ee', '#ffb340bb', '#ff6a2a66', '#ff6a2a00'])
    c.fillRect(0, 0, 80, 80)
    c.restore()
  })
  bake(scene, 'magic-ring', 80, 80, (c) => {
    c.beginPath()
    c.arc(40, 40, 36, 0, Math.PI * 2)
    c.strokeStyle = '#ffffff'
    c.lineWidth = 4
    c.stroke()
    c.beginPath()
    c.arc(40, 40, 31, 0, Math.PI * 2)
    c.strokeStyle = '#ffffff66'
    c.lineWidth = 3
    c.stroke()
  })
}
