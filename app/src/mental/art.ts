import { CAT_H, CAT_W } from '@web/features/game/cat/draw'

import type Phaser from 'phaser'
import { CAT_SCALE, mateModel } from './catModels'
import { drawEmber, drawPillar, drawWater, drawWave, drawWoodenRam } from './effectArt'
import { orderShares, type UnitKind } from './enemies'
import { WALK_FRAMES, walkPose } from './enemyWalk'
import type { Genre } from './genres'
import { MATE_LOOKS } from './mates'
import { shareLabel, sharesOf } from './shares'
import { drawMentalWall, drawSprite, drawToySellWall, STAGE_HERO } from './stageArt'
import { drawWeaponBullet, drawWeaponImpact, WEAPON_GRADES } from './weaponVisuals'

/** 승인한 캐주얼 시안의 투명 스프라이트를 Phaser 텍스처로 굽고, 무기·벽·탄환을 실시간 상태에 맞춰 합성한다. */

/** 화면 배율. 텍스처를 이만큼 크게 굽고 캔버스도 이만큼 크다(battle.ts). 그림 크기(setDisplaySize)는 배율과 상관없이 아래 상수(CSS px)를 쓴다. */
export const DPR = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)

/** 매수벽과 매도벽의 물량 글자는 같은 서체·크기·외곽선으로 표시한다. */
export const WALL_LABEL_STYLE = {
  fontFamily: '"Jua", "Gowun Dodum", sans-serif',
  fontSize: '18px',
  color: '#ffffff',
  align: 'center',
  stroke: '#79553a',
  strokeThickness: 4,
  lineSpacing: -3,
  resolution: DPR,
} satisfies Phaser.Types.GameObjects.Text.TextStyle

/** 사장냥의 화면 크기(px): 상자 100×110의 0.72배. 레퍼런스처럼 화면 높이의 1/12쯤. */
export const HERO_SCALE = CAT_SCALE
export const HERO_SIZE = { w: CAT_W * HERO_SCALE, h: CAT_H * HERO_SCALE }
/** 기존 표적 분배·조준 기준점. 외형 변경으로 전투 규칙을 바꾸지 않는다. */
export const GUN = {
  dx: (STAGE_HERO.gunX - CAT_W / 2) * HERO_SCALE,
  dy: (STAGE_HERO.gunY - CAT_H / 2) * HERO_SCALE,
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

/** 승인한 총·앞발 일체형 원본을 그대로 사용하고 피격 상태만 덧칠한다. */
export const HERO_KEYS = ['hero-idle', 'hero-fire', 'hero-hurt'] as const

export function bakeHero(scene: Phaser.Scene) {
  const source = scene.textures.get('art-hero').getSourceImage() as HTMLImageElement
  for (const key of HERO_KEYS) {
    bake(scene, key, CAT_W, CAT_H, (c) => {
      c.fillStyle = '#98633633'
      c.beginPath()
      c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
      c.fill()
      drawSprite(
        c,
        source,
        { x: 0, y: 0, w: source.width, h: source.height },
        { x: 14, y: 3, w: 75, h: 100 },
        'height',
      )
      if (key === 'hero-hurt') {
        c.globalCompositeOperation = 'source-atop'
        c.fillStyle = '#fc795e33'
        c.fillRect(0, 0, CAT_W, CAT_H)
      }
    })
  }
}

/** 기존 동료 순서에 승인한 접힌 귀·장모 모델을 번갈아 사용한다. */
export const mateKey = (i: number) => `mate-${i}`

export function bakeMates(scene: Phaser.Scene) {
  for (let i = 0; i < MATE_LOOKS.length; i++) {
    const source = scene.textures.get(`art-${mateModel(i)}`).getSourceImage() as HTMLImageElement
    bake(scene, mateKey(i), CAT_W, CAT_H, (c) => {
      c.fillStyle = '#98633633'
      c.beginPath()
      c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
      c.fill()
      drawSprite(
        c,
        source,
        { x: 0, y: 0, w: source.width, h: source.height },
        { x: 14, y: 3, w: 75, h: 100 },
        'height',
      )
    })
  }
}
/** 고정된 크기의 8프레임 보행. 그림만 변형하고 충돌 원은 유지한다. */
export function enemyKey(kind: UnitKind, frame: number): string {
  return `${kind}-${frame}`
}

export function bakeEnemies(scene: Phaser.Scene) {
  const source = scene.textures.get('art-enemies').getSourceImage() as HTMLImageElement
  const kinds = ['panic', 'dump', 'spec', 'stop', 'short'] as const
  for (const [i, kind] of kinds.entries()) {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = ENEMY_SIZE * DPR
    const paint = sprite.getContext('2d')
    if (!paint) continue
    paint.scale(DPR, DPR)
    const size = kind === 'spec' ? 55 : kind === 'panic' ? 43 : 49
    const image =
      kind === 'short'
        ? (scene.textures.get('art-shortSeller').getSourceImage() as HTMLImageElement)
        : source
    const cell =
      kind === 'short'
        ? { x: 0, y: 0, w: image.width, h: image.height }
        : {
            x: ((i % 2) * source.width) / 2,
            y: (Math.floor(i / 2) * source.height) / 2,
            w: source.width / 2,
            h: source.height / 2,
          }
    drawSprite(paint, image, cell, { x: 32 - size / 2, y: 32 - size / 2, w: size, h: size })
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
  const blocks = scene.textures.get('art-wallBlocks').getSourceImage() as HTMLImageElement
  for (const cracked of [false, true]) {
    bake(scene, cracked ? 'wall-cracked' : 'wall', 512, 96, (c) =>
      drawMentalWall(c, blocks, cracked),
    )
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
  for (const grade of WEAPON_GRADES) {
    for (const look of [0, 1] as const) {
      bake(scene, `bullet-${grade}-${look}`, 32, 10, (c) => drawWeaponBullet(c, grade, look))
    }
    bake(scene, `impact-${grade}`, 80, 80, (c) => drawWeaponImpact(c, grade))
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
  bake(scene, 'magic-drop', 32, 20, drawWater)
  // 큰 물결: 오른쪽(나아가는 쪽)으로 부푼 초승달. 앞은 흰 거품, 뒤로 갈수록 옅은 파랑.
  bake(scene, 'magic-wave', 44, 120, drawWave)
  // 불덩이: 흰 심 → 노랑 → 주황 → 빨강으로 번진다.
  bake(scene, 'magic-ember', 28, 28, drawEmber)
  // 불기둥: 아래가 하얗게 뜨겁고 위로 갈수록 빨갛게 사라지는 일렁이는 기둥. 원점은 아래 가운데.
  bake(scene, 'magic-pillar', 48, 140, drawPillar)
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
  // 목제 공성 충차: 나무 프레임·밧줄·통나무 단면. 오른쪽 앞끝을 위로 돌려 들이받는다.
  bake(scene, 'magic-ram', 88 * RAM_ART, 48 * RAM_ART, (c) => {
    c.scale(RAM_ART, RAM_ART)
    drawWoodenRam(c)
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
export const CELL_TEX = { w: 360, h: 60 }
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
  const amountSize = Math.round(h * 0.44)
  c.font = `${amountSize}px ${ORDER_FONT}`
  const fit = Math.min(1, (w - 8) / Math.max(1, c.measureText(look.amount).width))
  c.font = `${amountSize * fit}px ${ORDER_FONT}`
  c.lineWidth = 3
  c.strokeStyle = look.edge
  c.strokeText(look.amount, x + w / 2, y + h * 0.68)
  c.fillText(look.amount, x + w / 2, y + h * 0.68)
  c.restore()
}

/** 매도 주문과 같은 투톤 서식. 색과 제목만 매수로 바꾸고 아래에 실제 물량을 표시한다. */
export function buyOrderTexture(scene: Phaser.Scene, damage: number): string {
  const key = `buy-order-${sharesOf(damage)}`
  if (!scene.textures.exists(key)) {
    bake(scene, key, 64, 64, (c) =>
      ticket(
        c,
        { x: 11, y: 18, w: 42, h: 28 },
        {
          fill: '#ef6965',
          edge: '#8e2633',
          band: '#c83f4a',
          title: '매수',
          amount: shareLabel(damage),
        },
      ),
    )
  }
  return key
}

/** 작은 크기에서도 얼굴과 넓은 팻말이 구분되는 큰손 고래. 모든 윤곽은 64×64 안에 둔다. */
export function drawWhale(c: CanvasRenderingContext2D) {
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const ink = '#203d68'
  const fill = (color: string, width = 1.6) => {
    c.fillStyle = color
    c.fill()
    c.strokeStyle = ink
    c.lineWidth = width
    c.stroke()
  }
  c.fillStyle = '#19325224'
  c.beginPath()
  c.ellipse(32, 59, 23, 3, 0, 0, Math.PI * 2)
  c.fill()
  // 단순한 두 갈래 꼬리. 끝과 외곽선까지 그림 영역 안에 여백을 둔다.
  c.beginPath()
  c.moveTo(47, 32)
  c.quadraticCurveTo(53, 29, 59, 22)
  c.quadraticCurveTo(61, 30, 56, 34)
  c.quadraticCurveTo(61, 35, 60, 42)
  c.quadraticCurveTo(53, 41, 47, 38)
  c.closePath()
  fill('#4f8ccd')
  // 둥근 몸통과 옅은 배. 작은 주문서 장식을 덜어 얼굴을 또렷하게 한다.
  const body = c.createLinearGradient(0, 20, 0, 52)
  body.addColorStop(0, '#6da9df')
  body.addColorStop(1, '#3476b5')
  c.beginPath()
  c.ellipse(28, 35, 23, 17, -0.05, 0, Math.PI * 2)
  c.fillStyle = body
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 1.8
  c.stroke()
  c.beginPath()
  c.ellipse(27, 43, 17, 7, 0, 0, Math.PI * 2)
  c.fillStyle = '#b7ddf4'
  c.fill()
  // 눈과 짧은 눈썹, 입. 진한 윤곽의 크기를 통일한다.
  c.beginPath()
  c.ellipse(18, 31, 3.5, 4, 0, 0, Math.PI * 2)
  c.fillStyle = '#fff8e9'
  c.fill()
  c.beginPath()
  c.arc(17.5, 31.5, 1.7, 0, Math.PI * 2)
  c.fillStyle = ink
  c.fill()
  c.beginPath()
  c.moveTo(13, 25.5)
  c.lineTo(22, 27.5)
  c.strokeStyle = ink
  c.lineWidth = 1.7
  c.stroke()
  c.beginPath()
  c.moveTo(12, 39)
  c.quadraticCurveTo(18, 41, 23, 38)
  c.stroke()
  // 큰손을 나타내는 모자: 작은 띠 하나만 남긴다.
  c.beginPath()
  c.roundRect(20, 5, 17, 13, 3)
  fill('#27354e')
  c.fillStyle = '#d9b66c'
  c.fillRect(21, 13, 15, 2.5)
  c.beginPath()
  c.roundRect(15, 17, 27, 4, 2)
  fill('#27354e', 1.2)
  // 지느러미가 팻말의 양끝을 잡는다.
  for (const x of [8, 52]) {
    c.beginPath()
    c.ellipse(x, 46, 4, 5, x < 32 ? -0.35 : 0.35, 0, Math.PI * 2)
    fill('#4f8ccd', 1.2)
  }
  const plate = { x: 8, y: 44, w: 48, h: 16 }
  c.beginPath()
  c.roundRect(plate.x, plate.y, plate.w, plate.h, 4)
  fill('#fff6df', 1.5)
  const text = '대량 매도'
  const baseSize = 10
  c.font = `${baseSize}px ${ORDER_FONT}`
  const size = Math.min(
    baseSize,
    (baseSize * (plate.w - 8)) / Math.max(1, c.measureText(text).width),
  )
  c.font = `${size}px ${ORDER_FONT}`
  c.fillStyle = '#254e80'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, plate.x + plate.w / 2, plate.y + plate.h / 2 + 0.5)
  c.restore()
}

/**
 * 매도 물량 그림: 64×64 칸 가운데에 그린다(battle.ts가 종류마다 배율을 곱해 놓는다). 프레임마다 살짝 떠올랐다 가라앉아(그림 안에서만) 걷는 고양이 적처럼
 * 같은 열쇠(enemyKey)로 돌린다. 매도벽 칸은 금 간 정도마다 하나씩.
 */
export function bakeOrders(scene: Phaser.Scene, hpScale = 1) {
  const looks = {
    order: {
      box: { x: 7, y: 17, w: 50, h: 30 },
      look: {
        fill: '#3a7bea',
        edge: '#1b3f8f',
        band: '#2a5fc4',
        title: '매도',
        amount: `${orderShares('order', hpScale).toLocaleString('ko-KR')}주`,
      },
    },
    market: {
      box: { x: 9, y: 20, w: 46, h: 26 },
      look: {
        fill: '#5aa2ff',
        edge: '#1f56b8',
        band: '#3f86ea',
        title: '시장가',
        amount: `${orderShares('market', hpScale).toLocaleString('ko-KR')}주`,
      },
    },
    bulk: {
      box: { x: 6, y: 14, w: 52, h: 36 },
      look: {
        fill: '#2347a8',
        edge: '#0b1f5c',
        band: '#16337f',
        title: '대량 매도',
        amount: `${orderShares('bulk', hpScale).toLocaleString('ko-KR')}주`,
      },
    },
    fake: {
      box: { x: 7, y: 17, w: 50, h: 30 },
      look: {
        fill: '#9db6dc',
        edge: '#5c78a8',
        band: '#8aa3cc',
        title: '허매도',
        amount: `${orderShares('fake', hpScale).toLocaleString('ko-KR')}주`,
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
      drawWhale(c)
      c.restore()
    })
  }
  // 블록 질감만 교체한다. 균열 단계와 물량 표시는 기존 전투 상태를 따른다.
  const blocks = scene.textures.get('art-wallBlocks').getSourceImage() as HTMLImageElement
  for (let crack = 0; crack < CELL_CRACKS; crack++) {
    bake(scene, cellKey(crack), CELL_TEX.w, CELL_TEX.h, (c) => drawToySellWall(c, blocks, crack))
  }
  // 벽 뒤 판: 블록 사이를 잇는 옅은 접지 그림자.
  bake(scene, 'wall-band', 64, 32, (c) => {
    c.fillStyle = '#416fa426'
    c.fillRect(0, 0, 64, 32)
    c.fillStyle = '#78aee4'
    c.fillRect(0, 0, 64, 2)
    c.fillRect(0, 30, 64, 2)
  })
  // 파편: 푸른색 매도벽 조각과 흰 먼지.
  bake(scene, 'chip', 6, 5, (c) => {
    c.fillStyle = '#669ded'
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
