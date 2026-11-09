import { CAT_H, CAT_W, GUN_LEN } from '@web/features/game/cat/draw'
import { BOSS_LOOK } from '@web/features/game/cat/look'
import type Phaser from 'phaser'
import { drawStageGun } from './drawStageGun'
import type { UnitKind } from './enemies'
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
export function enemyKey(kind: UnitKind, frame: number): string {
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
  // 클리어 색종이(공격 판): 흰 네모를 물들여 쓴다.
  bake(scene, 'confetti', 6, 10, (c) => {
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, 6, 10)
  })
  // 땅 (433번): 충차. 위에서 내려다본 공성 수레: 바퀴 넷 위에 판자 지붕, 그 밑으로 들보가 나오고 끝에 뾰족한 쇠 쐐기. 오른쪽이 나아가는
  // 쪽이고 화면에서는 위로 돌려 아래에서 위로 들이받는다.
  // 크게 늘여 쓰니 RAM_ART배로 구워 흐려지지 않게 한다.
  bake(scene, 'magic-ram', 88 * RAM_ART, 48 * RAM_ART, (c) => {
    c.scale(RAM_ART, RAM_ART)
    // 땅에 드리운 그림자: 수레 몸통만, 살짝 비껴서
    c.fillStyle = '#1a120a33'
    c.beginPath()
    c.roundRect(6, 12, 46, 32, 4)
    c.fill()
    // 바퀴 넷(양옆으로 삐져나온다)
    for (const [x, y] of [
      [16, 6],
      [16, 42],
      [40, 6],
      [40, 42],
    ]) {
      c.fillStyle = '#3a2814'
      c.fillRect(x - 7, y - 4, 14, 8)
      c.fillStyle = '#6b4a28'
      c.fillRect(x - 5, y - 3, 10, 6)
      c.fillStyle = '#2a1c0e'
      for (const dx of [-3, 0, 3]) c.fillRect(x + dx - 0.6, y - 3, 1.2, 6)
    }
    // 들보: 지붕 밑에서 앞으로 나온 네모난 나무 들보
    c.fillStyle = '#7a4e26'
    c.fillRect(44, 17, 18, 14)
    c.fillStyle = '#5a3818'
    c.fillRect(44, 27, 18, 4)
    c.strokeStyle = '#2e1c0a'
    c.lineWidth = 1.5
    c.strokeRect(44, 17, 18, 14)
    // 판자 지붕
    c.fillStyle = '#9a6a3a'
    c.fillRect(4, 8, 44, 32)
    c.fillStyle = '#b5814a'
    for (let x = 6; x < 46; x += 8) c.fillRect(x, 10, 5, 28)
    c.strokeStyle = '#2e1c0a'
    c.lineWidth = 2
    c.strokeRect(4, 8, 44, 32)
    // 쇠 띠와 못
    c.fillStyle = '#4c5560'
    c.fillRect(4, 13, 44, 3)
    c.fillRect(4, 32, 44, 3)
    c.fillStyle = '#c9d2dc'
    for (const x of [8, 26, 44]) {
      c.fillRect(x - 1, 13.5, 2, 2)
      c.fillRect(x - 1, 32.5, 2, 2)
    }
    // 쇠 고리(들보와 쐐기 이음)
    c.fillStyle = '#4c5560'
    c.fillRect(60, 14, 5, 20)
    c.fillStyle = '#9aa6b2'
    c.fillRect(60, 14, 5, 3)
    // 뾰족한 쇠 쐐기
    c.beginPath()
    c.moveTo(64, 10)
    c.lineTo(87, 24)
    c.lineTo(64, 38)
    c.closePath()
    const steel = c.createLinearGradient(0, 10, 0, 38)
    steel.addColorStop(0, '#eef2f6')
    steel.addColorStop(0.5, '#9aa6b2')
    steel.addColorStop(1, '#4a535e')
    c.fillStyle = steel
    c.fill()
    c.strokeStyle = '#262c33'
    c.lineWidth = 1.8
    c.stroke()
    // 날 선 등줄기
    c.strokeStyle = '#ffffff'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(65, 24)
    c.lineTo(85, 24)
    c.stroke()
  })
  // 돌 조각: 충차 뒤로 튀는 흙·돌 파편과 땅에서 솟는 돌기둥.
  bake(scene, 'magic-rock', 14, 12, (c) => {
    c.beginPath()
    c.moveTo(2, 7)
    c.lineTo(5, 2)
    c.lineTo(11, 1.5)
    c.lineTo(13, 7)
    c.lineTo(8, 11)
    c.lineTo(3, 10.5)
    c.closePath()
    c.fillStyle = '#a8865c'
    c.fill()
    c.strokeStyle = '#4a3420'
    c.lineWidth = 1.2
    c.stroke()
  })
  bake(scene, 'magic-spike', 28, 48, (c) => {
    c.beginPath()
    c.moveTo(2, 48)
    c.lineTo(9, 14)
    c.lineTo(15, 1)
    c.lineTo(20, 16)
    c.lineTo(26, 48)
    c.closePath()
    const g = c.createLinearGradient(0, 0, 28, 0)
    g.addColorStop(0, '#d2b384')
    g.addColorStop(0.5, '#9a7346')
    g.addColorStop(1, '#5a3e22')
    c.fillStyle = g
    c.fill()
    c.strokeStyle = '#3a2814'
    c.lineWidth = 1.6
    c.stroke()
  })
}

// ── 공격 판 (decisions.md 413번, #573): 매도벽 칸·매도 물량 주문서·큰손 보스·파편·속도선

/** 충차 그림을 구운 배율: 화면에서 두세 배로 키워 쓴다(battle.ts). */
export const RAM_ART = 2.5

/** 매도벽 칸 텍스처의 크기(px). 화면에서는 칸 크기로 늘여 놓는다. 금 간 정도 0~3. */
export const CELL_TEX = { w: 60, h: 30 }
export const CELL_CRACKS = 4
export const cellKey = (crack: number) => `cell-${crack}`

const ORDER_FONT = '"Jua", "Gowun Dodum", sans-serif'

/** 주문서 한 장: 둥근 종이에 위 띠(종류)와 큰 물량 숫자. dashed면 허매도(점선 테두리, 옅게). */
function ticket(
  c: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  look: {
    fill: string
    edge: string
    band: string
    title: string
    amount: string
    dashed?: boolean
  },
) {
  const { x, y, w, h } = box
  c.save()
  if (look.dashed) c.globalAlpha = 0.78
  c.fillStyle = '#10204a33'
  c.beginPath()
  c.roundRect(x + 1.5, y + 2.5, w, h, 6)
  c.fill()
  c.fillStyle = look.fill
  c.beginPath()
  c.roundRect(x, y, w, h, 6)
  c.fill()
  c.fillStyle = look.band
  c.beginPath()
  c.roundRect(x, y, w, h * 0.38, [6, 6, 0, 0])
  c.fill()
  c.lineWidth = 2
  c.strokeStyle = look.edge
  if (look.dashed) c.setLineDash([4, 3])
  c.beginPath()
  c.roundRect(x, y, w, h, 6)
  c.stroke()
  c.setLineDash([])
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#ffffff'
  c.font = `${Math.round(h * 0.28)}px ${ORDER_FONT}`
  c.fillText(look.title, x + w / 2, y + h * 0.2)
  c.font = `${Math.round(h * 0.44)}px ${ORDER_FONT}`
  c.lineWidth = 3
  c.strokeStyle = look.edge
  c.strokeText(look.amount, x + w / 2, y + h * 0.68)
  c.fillText(look.amount, x + w / 2, y + h * 0.68)
  c.restore()
}

/** 큰손 보스: 파란 고래가 정장 모자를 쓰고 "대량 매도" 팻말을 든다. */
function whale(c: CanvasRenderingContext2D) {
  c.fillStyle = '#10204a33'
  c.beginPath()
  c.ellipse(32, 57, 24, 4, 0, 0, Math.PI * 2)
  c.fill()
  // 꼬리
  c.fillStyle = '#1f3f99'
  c.beginPath()
  c.moveTo(52, 34)
  c.quadraticCurveTo(62, 22, 63, 18)
  c.quadraticCurveTo(58, 30, 63, 42)
  c.quadraticCurveTo(58, 40, 52, 40)
  c.closePath()
  c.fill()
  // 몸
  c.beginPath()
  c.ellipse(30, 36, 25, 17, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#9cc2ff'
  c.beginPath()
  c.ellipse(28, 44, 19, 8, 0, 0, Math.PI)
  c.fill()
  c.lineWidth = 2
  c.strokeStyle = '#0d2466'
  c.beginPath()
  c.ellipse(30, 36, 25, 17, 0, 0, Math.PI * 2)
  c.stroke()
  // 눈썹·눈(못마땅한 얼굴)
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.ellipse(17, 31, 4, 4, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#0d2466'
  c.beginPath()
  c.ellipse(16, 32, 2, 2.2, 0, 0, Math.PI * 2)
  c.fill()
  c.lineWidth = 2
  c.beginPath()
  c.moveTo(11, 25)
  c.lineTo(22, 28)
  c.stroke()
  // 모자(큰손)
  c.fillStyle = '#2b2340'
  c.fillRect(20, 6, 18, 12)
  c.fillRect(15, 17, 28, 3.5)
  c.fillStyle = '#ff4f6d'
  c.fillRect(20, 14, 18, 2.5)
  // 물줄기 대신 쏟아지는 주문서
  c.fillStyle = '#cfe2ff'
  c.fillRect(42, 13, 7, 5)
  c.fillRect(48, 7, 6, 4)
  // 팻말
  c.fillStyle = '#fff9ec'
  c.strokeStyle = '#0d2466'
  c.lineWidth = 1.5
  c.beginPath()
  c.roundRect(14, 40, 30, 13, 3)
  c.fill()
  c.stroke()
  c.fillStyle = '#1f3f99'
  c.font = `9px ${ORDER_FONT}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('대량 매도', 29, 47)
}

/**
 * 매도 물량 그림: 64×64 칸 가운데에 그린다(battle.ts가 종류마다 배율을 곱해 놓는다). 프레임마다 살짝 떠올랐다 가라앉아(그림 안에서만) 걷는 고양이 적처럼
 * 같은 열쇠(enemyKey)로 돌린다. 매도벽 칸은 금 간 정도마다 하나씩.
 */
export function bakeOrders(scene: Phaser.Scene) {
  const looks = {
    order: {
      box: { x: 11, y: 18, w: 42, h: 28 },
      look: { fill: '#3a7bea', edge: '#1b3f8f', band: '#2a5fc4', title: '매도', amount: '300주' },
    },
    market: {
      box: { x: 15, y: 22, w: 34, h: 21 },
      look: { fill: '#5aa2ff', edge: '#1f56b8', band: '#3f86ea', title: '시장가', amount: '100' },
    },
    bulk: {
      box: { x: 6, y: 14, w: 52, h: 36 },
      look: {
        fill: '#2347a8',
        edge: '#0b1f5c',
        band: '#16337f',
        title: '대량 매도',
        amount: '5,000주',
      },
    },
    fake: {
      box: { x: 11, y: 18, w: 42, h: 28 },
      look: {
        fill: '#9db6dc',
        edge: '#5c78a8',
        band: '#8aa3cc',
        title: '허매도',
        amount: '800주',
        dashed: true,
      },
    },
  } as const
  for (let frame = 0; frame < WALK_FRAMES; frame++) {
    const phase = (frame / WALK_FRAMES) * Math.PI * 2
    for (const [kind, v] of Object.entries(looks)) {
      bake(scene, enemyKey(kind as UnitKind, frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
        // 그림자는 제자리, 종이만 들썩인다. 시장가는 더 빨리 흔들린다.
        c.fillStyle = '#10204a26'
        c.beginPath()
        c.ellipse(32, 56, v.box.w * 0.42, 3.5, 0, 0, Math.PI * 2)
        c.fill()
        c.save()
        c.translate(32, 32 + Math.sin(phase) * 1.6)
        c.rotate(Math.sin(phase + 1) * (kind === 'market' ? 0.08 : 0.04))
        c.translate(-32, -32)
        // 대량 매도는 뒤에 겹친 종이 두 장.
        if (kind === 'bulk') {
          for (const d of [6, 3]) {
            c.fillStyle = d === 6 ? '#0b1f5c88' : '#16337fbb'
            c.beginPath()
            c.roundRect(v.box.x + d, v.box.y - d, v.box.w, v.box.h, 6)
            c.fill()
          }
        }
        // 시장가는 아래로 쏟아지는 꼬리(속도선) 셋.
        if (kind === 'market') {
          c.strokeStyle = '#9cc8ff'
          c.lineWidth = 2
          for (const dx of [-9, 0, 9]) {
            c.beginPath()
            c.moveTo(32 + dx, v.box.y - 2)
            c.lineTo(32 + dx, v.box.y - 10)
            c.stroke()
          }
        }
        ticket(c, v.box, v.look)
        c.restore()
      })
    }
    bake(scene, enemyKey('whale', frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
      c.save()
      c.translate(0, Math.sin(phase) * 1.2)
      whale(c)
      c.restore()
    })
  }
  // 매도벽 칸: 파란 호가 칸. 금은 맞을수록 늘고 3단계는 이가 빠진다. 물량 글자는 battle.ts가 Text로 얹는다.
  for (let crack = 0; crack < CELL_CRACKS; crack++) {
    bake(scene, cellKey(crack), CELL_TEX.w, CELL_TEX.h, (c) => {
      const { w, h } = CELL_TEX
      const g = c.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, crack >= 2 ? '#5b8fdc' : '#6aa5ff')
      g.addColorStop(1, crack >= 2 ? '#2f5fb0' : '#3b74d6')
      c.fillStyle = g
      c.beginPath()
      if (crack === 3) {
        c.moveTo(2, 2)
        c.lineTo(w - 14, 2)
        c.lineTo(w - 8, 9)
        c.lineTo(w - 2, 7)
        c.lineTo(w - 2, h - 2)
        c.lineTo(12, h - 2)
        c.lineTo(6, h - 8)
        c.lineTo(2, h - 6)
        c.closePath()
      } else {
        c.roundRect(2, 2, w - 4, h - 4, 4)
      }
      c.fill()
      c.lineWidth = 2
      c.strokeStyle = '#173f8f'
      c.stroke()
      c.fillStyle = '#ffffff40'
      c.fillRect(5, 4, w - 10, 3)
      if (crack > 0) {
        c.strokeStyle = '#0d2466'
        c.lineWidth = 1.6
        c.lineJoin = 'round'
        const lines: number[][][] = [
          [
            [w * 0.3, 2],
            [w * 0.36, h * 0.45],
            [w * 0.28, h * 0.7],
          ],
          [
            [w * 0.72, h - 2],
            [w * 0.66, h * 0.55],
            [w * 0.78, h * 0.3],
            [w * 0.7, 3],
          ],
          [
            [3, h * 0.4],
            [w * 0.18, h * 0.55],
            [w * 0.36, h * 0.45],
            [w * 0.52, h * 0.62],
            [w * 0.66, h * 0.55],
          ],
        ]
        for (const line of lines.slice(0, crack)) {
          c.beginPath()
          for (const [i, [x, y]] of line.entries()) {
            if (i) c.lineTo(x, y)
            else c.moveTo(x, y)
          }
          c.stroke()
        }
        c.strokeStyle = '#d8e8ff88'
        c.lineWidth = 0.8
        for (const line of lines.slice(0, crack)) {
          c.beginPath()
          for (const [i, [x, y]] of line.entries()) {
            if (i) c.lineTo(x + 1, y + 1)
            else c.moveTo(x + 1, y + 1)
          }
          c.stroke()
        }
      }
    })
  }
  // 벽 뒤 판: 칸들이 박힌 짙은 남색 띠(호가창 줄).
  bake(scene, 'wall-band', 64, 32, (c) => {
    c.fillStyle = '#14234add'
    c.fillRect(0, 0, 64, 32)
    c.fillStyle = '#8fb8ff'
    c.fillRect(0, 0, 64, 2)
    c.fillRect(0, 30, 64, 2)
  })
  // 파편: 파란 벽 조각과 흰 먼지.
  bake(scene, 'chip', 6, 5, (c) => {
    c.fillStyle = '#4f8df0'
    c.beginPath()
    c.moveTo(0, 1)
    c.lineTo(5, 0)
    c.lineTo(6, 4)
    c.lineTo(1, 5)
    c.closePath()
    c.fill()
  })
  // 속도선: 위로 치고 오를 때 화면을 지나가는 흰 줄.
  bake(scene, 'speedline', 4, 90, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 90)
    g.addColorStop(0, '#ffffff00')
    g.addColorStop(0.5, '#ffffffcc')
    g.addColorStop(1, '#ffffff00')
    c.fillStyle = g
    c.fillRect(1, 0, 2, 90)
  })
}
