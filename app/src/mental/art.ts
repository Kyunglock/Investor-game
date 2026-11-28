import { CAT_H, CAT_W, type GunGrade } from '@web/features/game/cat/draw'

import type Phaser from 'phaser'
import { drawBattleGun } from './battleWeaponArt'
import type { Spell } from './cards'
import { CAT_GUN } from './catGun'
import { CAT_SCALE, type CatModel } from './catModels'
import { drawCatPose } from './catPoseArt'
import { drawCatRun } from './catRunArt'
import { drawEmber, drawGust, drawIceLance, drawPillar } from './effectArt'
import { isLocalMob, LOCAL_MOBS, orderShares, type UnitKind } from './enemies'
import { WALK_FRAMES, walkPose } from './enemyWalk'
import type { Genre } from './genres'
import { MATE_LOOKS } from './mates'
import { shareLabel, sharesOf } from './shares'
import {
  EXTRA_SPELLS,
  type ExtraSpell,
  ICE_GLYPH,
  isArrowSpell,
  SPELLBOOK,
  WIND_GLYPH,
} from './spellbook'
import {
  drawElementArrow,
  fireBloom,
  fish,
  fishWave,
  paw,
  pawComet,
  spellSprites,
  stoneRam,
} from './spellSprites'
import { drawBuyWall, drawMentalWall, drawSprite, drawToySellWall, STAGE_HERO } from './stageArt'
import { BULLET_ART, drawWeaponBullet, drawWeaponImpact, WEAPON_GRADES } from './weaponVisuals'

/** 승인한 캐주얼 시안의 투명 스프라이트를 Phaser 텍스처로 굽고, 무기·벽·탄환을 실시간 상태에 맞춰 합성한다. */

/** 화면 배율. 텍스처를 이만큼 크게 굽고 캔버스도 이만큼 크다(battle.ts). 그림 크기(setDisplaySize)는 배율과 상관없이 아래 상수(CSS px)를 쓴다. */
/** 띠 텍스처 윗변에서 크림빛 명중선까지의 거리(px). x는 전장 너비에 대한 비율이다. */
export function auroraEdge(x: number) {
  return 45 + 17 * Math.sin(Math.PI * x) + 5 * Math.sin(4 * Math.PI * x)
}

/** 뒤쪽 주름의 위치를 그림과 접촉 판정에서 함께 쓴다. */
export function auroraFold(u: number, back: boolean) {
  const fold = Math.sin(12 * u + 2 * Math.sin(5 * u))
  const edge = auroraEdge(u) - (back ? 13 + 10 * fold : 0)
  const height = Math.min(edge - 2, (back ? 21 : 18) + 15 * fold ** 2 + 6 * Math.sin(26 * u) ** 2)
  return { fold, edge, height }
}

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
function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: Painter,
  redraw = false,
) {
  if (scene.textures.exists(key)) {
    // 같은 그림을 다시 칠한다: 이미 화면에 있는 것도 함께 바뀐다 (자동 전투의 물량 수량, 498번).
    const old = scene.textures.get(key) as Phaser.Textures.CanvasTexture
    if (!redraw || typeof old.getContext !== 'function') return
    const c = old.getContext()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, old.width, old.height)
    c.scale(DPR, DPR)
    paint(c)
    old.refresh()
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

/** 장착 무기를 원본 고양이와 합성하고 피격 상태만 덧칠한다. */
export const HERO_KEYS = ['hero-idle', 'hero-fire', 'hero-hurt'] as const

function drawRigBody(scene: Phaser.Scene, c: CanvasRenderingContext2D, index = 4, look?: number) {
  const asset = look === undefined ? 'heroPoses' : MATE_LOOKS[look].poses
  const source = scene.textures.get(`art-${asset}`).getSourceImage() as HTMLImageElement
  drawCatPose(
    c,
    source,
    index,
    look !== undefined && 'slot' in MATE_LOOKS[look] ? MATE_LOOKS[look] : undefined,
  )
}

function shadow(c: CanvasRenderingContext2D) {
  c.fillStyle = '#98633633'
  c.beginPath()
  c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
  c.fill()
}

/** 첫 화면에도 준비 화면과 같은 중앙 견착 자세를 쓴다. */
export function bakeHero(scene: Phaser.Scene, _grade: GunGrade) {
  for (const key of HERO_KEYS) {
    bake(scene, key, CAT_W, CAT_H, (c) => {
      shadow(c)
      drawRigBody(scene, c)
    })
  }
}

/** 총의 등급만 바꾼다. 고양이의 손·털·눈은 몸 그림에서 유지된다. */
export function bakeCatGun(scene: Phaser.Scene, grade: GunGrade, _model: CatModel, _look?: number) {
  const key = `cat-gun-${grade}`
  bake(scene, key, CAT_GUN.w, CAT_GUN.h, (c) => {
    drawBattleGun(
      c,
      scene.textures.get('art-battleWeapons').getSourceImage() as HTMLImageElement,
      grade,
    )
  })
  return key
}

/** 정지 자세는 캐시하고 달리기는 고양이마다 한 캔버스만 재사용한다. */
const runStates = new WeakMap<Phaser.Scene, Map<string, string>>()
const runSources = new WeakMap<
  Phaser.Scene,
  Map<string, { index: number; canvas: HTMLCanvasElement }>
>()
export function bakeCatBody(
  scene: Phaser.Scene,
  index: number,
  look?: number,
  runFrame?: number,
  hurt = false,
) {
  const base = look === undefined ? 'hero' : mateKey(look)
  const key = `${base}-pose-${index}${hurt ? '-hurt' : ''}`
  bake(scene, key, CAT_W, CAT_H, (c) => {
    shadow(c)
    drawRigBody(scene, c, index, look)
    if (hurt) {
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = '#fc795e33'
      c.fillRect(0, 0, CAT_W, CAT_H)
    }
  })
  if (runFrame === undefined || hurt) return key
  const runKey = `${base}-running`
  let states = runStates.get(scene)
  if (!states) {
    states = new Map()
    runStates.set(scene, states)
  }
  const state = `${index}-${runFrame}`
  if (states.get(runKey) === state && scene.textures.exists(runKey)) return runKey
  let sources = runSources.get(scene)
  if (!sources) {
    sources = new Map()
    runSources.set(scene, sources)
  }
  let source = sources.get(base)
  if (!source || source.index !== index) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(CAT_W * DPR)
    canvas.height = Math.ceil(CAT_H * DPR)
    const paint = canvas.getContext('2d', { willReadFrequently: true })
    if (!paint) return key
    paint.scale(DPR, DPR)
    // 보행 원본에는 몸만 그린다. 바닥 그림자는 변형하지 않는다.
    drawRigBody(scene, paint, index, look)
    source = { index, canvas }
    sources.set(base, source)
  }
  const sprite = source.canvas
  bake(
    scene,
    runKey,
    CAT_W,
    CAT_H,
    (c) => {
      shadow(c)
      drawCatRun(c, sprite, runFrame)
    },
    true,
  )
  states.set(runKey, state)
  return runKey
}

export const mateKey = (i: number) => `mate-${i}`

/** 스킬 표식의 한 변 (557번). */
export const SKILL_MARK = 28
/** 스킬 표식의 가운데가 고양이 가운데에서 올라간 높이: 머리에 닿을 만큼만 띄워 위의 매수벽 숫자와 겹치지 않게 한다. */
export const SKILL_MARK_RISE = 54
/** spellbook 마법의 전투 그림 (563번). */
export const spellKey = (spell: ExtraSpell) => `magic-${spell}`
export const skillMarkKey = (magic: Spell) => `skill-mark-${magic}`
/** 스킬마다 고유 색: 메뉴의 스킬 배지(idle/SkillBadge.tsx)와 같다. */
export const SKILL_MARK_COLORS: Record<
  Spell,
  { light: string; mid: string; dark: string; line: string }
> = {
  water: { light: '#e6f7ff', mid: '#5cc0ff', dark: '#1f72d8', line: '#103f86' },
  meteor: { light: '#fff0b8', mid: '#ff9a3d', dark: '#dc3b2a', line: '#7c1d12' },
  lightning: { light: '#fffbd0', mid: '#ffd633', dark: '#f09a00', line: '#7a4a00' },
  earth: { light: '#fbe8c2', mid: '#cf9257', dark: '#8a5326', line: '#4a2a10' },
  ice: { light: '#f2fdff', mid: '#8fe3f5', dark: '#2f9fc4', line: '#135a78' },
  wind: { light: '#f1fff5', mid: '#8fe0b0', dark: '#2f9d74', line: '#125a40' },
  // spellbook의 마법들 (563번).
  ...(Object.fromEntries(EXTRA_SPELLS.map((spell) => [spell, SPELLBOOK[spell].colors])) as Record<
    ExtraSpell,
    { light: string; mid: string; dark: string; line: string }
  >),
}
/** 스킬 그림 (48×48 칸): 스킬 배지의 첫 단계 그림과 같은 모양. 조각마다 칠할 색을 따로 준다(없으면 밝은 색). */
const SKILL_MARK_GLYPHS: Record<Spell, { d: string; fill?: string }[]> = {
  water: [{ d: 'M24 13.5c4.2 5 6.6 8.4 6.6 11.6a6.6 6.6 0 0 1-13.2 0c0-3.2 2.4-6.6 6.6-11.6Z' }],
  meteor: [
    { d: 'M16.5 24.3 34.3 13.3 23.9 31.7Z', fill: '#ffe98a' },
    { d: 'M15.4 27.5a5.1 5.1 0 1 0 10.2 0a5.1 5.1 0 1 0-10.2 0Z', fill: '#fff4c9' },
  ],
  lightning: [{ d: 'M26 13.5 18.2 25h4.4l-1.8 9.5L29.6 22h-4.8Z' }],
  earth: [
    { d: 'M13 21.2h15v6.4H13Z', fill: '#f6d9a2' },
    { d: 'M28 19.8 35 24.4 28 29Z', fill: '#e9edf2' },
    { d: 'M14.3 30.6a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0-5.4 0Z', fill: '#6a3f1b' },
    { d: 'M22.3 30.6a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0-5.4 0Z', fill: '#6a3f1b' },
  ],
  ice: [{ d: ICE_GLYPH }],
  wind: [{ d: WIND_GLYPH }],
  ...(Object.fromEntries(
    EXTRA_SPELLS.map((spell) => [spell, [{ d: SPELLBOOK[spell].glyph }]]),
  ) as Record<ExtraSpell, { d: string }[]>),
}

/**
 * 고양이 머리 위의 스킬 표식 (557번): 그 고양이가 쓰는 스킬을 스킬 색의 둥근 틀과 그림으로 보인다. 메뉴의 스킬 배지와 같은 색·모양이라
 * 전투 화면에서도 누가 무슨 스킬인지 알아본다.
 */
export function bakeSkillMarks(scene: Phaser.Scene) {
  for (const magic of Object.keys(SKILL_MARK_COLORS) as Spell[]) {
    const color = SKILL_MARK_COLORS[magic]
    bake(scene, skillMarkKey(magic), SKILL_MARK, SKILL_MARK, (c) => {
      // 배지의 48×48 칸에서 테두리(반지름 20)까지만 잘라 쓴다.
      c.scale(SKILL_MARK / 42, SKILL_MARK / 42)
      c.translate(-3, -3)
      const disc = (r: number, fill: string | CanvasGradient) => {
        c.beginPath()
        c.arc(24, 24, r, 0, Math.PI * 2)
        c.fillStyle = fill
        c.fill()
      }
      const rim = c.createLinearGradient(0, 4, 0, 44)
      rim.addColorStop(0, color.light)
      rim.addColorStop(1, color.mid)
      const face = c.createRadialGradient(18, 14, 0, 24, 24, 20)
      face.addColorStop(0, color.mid)
      face.addColorStop(1, color.dark)
      disc(20, color.line)
      disc(18, rim)
      disc(16.4, color.line)
      disc(15.4, face)
      c.lineJoin = 'round'
      c.lineCap = 'round'
      c.lineWidth = 2.4
      c.strokeStyle = color.line
      for (const part of SKILL_MARK_GLYPHS[magic]) {
        const path = new Path2D(part.d)
        c.stroke(path)
        c.fillStyle = part.fill ?? color.light
        c.fill(path)
      }
    })
  }
}

export function bakeMates(scene: Phaser.Scene, _grades: readonly GunGrade[]) {
  for (let i = 0; i < MATE_LOOKS.length; i++) {
    bake(scene, mateKey(i), CAT_W, CAT_H, (c) => {
      shadow(c)
      drawRigBody(scene, c, 4, i)
    })
  }
}
/** 고정된 크기의 8프레임 보행. 그림만 변형하고 충돌 원은 유지한다. */
export function enemyKey(kind: UnitKind, frame: number, variant = false): string {
  return variant ? `${kind}-alt-${frame}` : `${kind}-${frame}`
}

const STAGE_MONSTER_COL = { panic: 0, dump: 1, spec: 2 } as const

export function hasStageMonster(kind: UnitKind): kind is keyof typeof STAGE_MONSTER_COL {
  return Object.hasOwn(STAGE_MONSTER_COL, kind)
}

export function bakeEnemies(scene: Phaser.Scene, stageVariants: boolean) {
  const source = scene.textures.get('art-enemies').getSourceImage() as HTMLImageElement
  const kinds = ['panic', 'dump', 'spec', 'stop', 'short', ...LOCAL_MOBS] as const
  for (const [i, kind] of kinds.entries()) {
    const single = kind === 'short' || isLocalMob(kind)
    const image = single
      ? (scene.textures
          .get(`art-${kind === 'short' ? 'shortSeller' : kind}`)
          .getSourceImage() as HTMLImageElement)
      : source
    const cell = single
      ? { x: 0, y: 0, w: image.width, h: image.height }
      : {
          x: ((i % 2) * source.width) / 2,
          y: (Math.floor(i / 2) * source.height) / 2,
          w: source.width / 2,
          h: source.height / 2,
        }
    const variants = [{ image, cell, variant: false }]
    if (stageVariants && hasStageMonster(kind)) {
      const sheet = scene.textures.get('art-stageMonsters').getSourceImage() as HTMLImageElement
      const w = sheet.width / 3
      variants.push({
        image: sheet,
        cell: { x: STAGE_MONSTER_COL[kind] * w, y: 0, w, h: sheet.height },
        variant: true,
      })
    }
    for (const { image, cell, variant } of variants) {
      const sprite = document.createElement('canvas')
      sprite.width = sprite.height = ENEMY_SIZE * DPR
      const paint = sprite.getContext('2d')
      if (!paint) continue
      paint.scale(DPR, DPR)
      const size = kind === 'spec' ? 55 : kind === 'panic' ? 43 : 49
      drawSprite(paint, image, cell, { x: 32 - size / 2, y: 32 - size / 2, w: size, h: size })
      for (let frame = 0; frame < WALK_FRAMES; frame++) {
        bake(scene, enemyKey(kind, frame, variant), ENEMY_SIZE, ENEMY_SIZE, (c) => {
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
}

/** 멘탈벽과 탄환은 실제 상태에 맞춰 게임 안에서 그린다. */
export function bakeStage(scene: Phaser.Scene, _genre: Genre) {
  // 멘탈 보호 스테이지의 멘탈벽은 예전 반투명 보호막 그림이다. 매도벽 돌파의 블록 질감은 쓰지 않는다.
  for (const cracked of [false, true]) {
    bake(scene, cracked ? 'wall-cracked' : 'wall', 512, 96, (c) => drawMentalWall(c, cracked))
  }
  // 매도벽 돌파의 매수벽은 붉은 장난감 블록이다. 멘탈벽 그림을 빌려 쓰지 않는다.
  const blocks = scene.textures.get('art-wallBlocks').getSourceImage() as HTMLImageElement
  for (const cracked of [false, true]) {
    bake(scene, cracked ? 'buy-wall-cracked' : 'buy-wall', 512, 96, (c) =>
      drawBuyWall(c, blocks, cracked),
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
      bake(scene, `bullet-${grade}-${look}`, BULLET_ART.w, BULLET_ART.h, (c) =>
        drawWeaponBullet(c, grade, look),
      )
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
  // 흰 점에 탄의 등급 빛깔을 입힌다 (512번).
  bake(scene, 'trail', 4, 4, (c) => {
    c.beginPath()
    c.ellipse(2, 2, 2, 2, 0, 0, Math.PI * 2)
    c.fillStyle = '#ffffff'
    c.fill()
  })
  // S 등급부터 탄이 흘리는 반짝이: 네 갈래 별.
  bake(scene, 'twinkle', 8, 8, (c) => {
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 1.1 : 4
      c.lineTo(4 + Math.cos((i * Math.PI) / 4) * r, 4 + Math.sin((i * Math.PI) / 4) * r)
    }
    c.closePath()
    c.fillStyle = '#ffffff'
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
export function bakeMagic(scene: Phaser.Scene, breakthrough = false) {
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
  bake(scene, 'magic-drop', 64, 64, fish)
  bake(scene, 'magic-wave', 64, 64, fishWave)
  bake(scene, 'magic-ice', 44, 16, drawIceLance)
  bake(scene, 'magic-gust', 44, 120, drawGust)
  bake(scene, 'magic-paw-comet', 64, 64, pawComet)
  bake(scene, 'magic-paw-warning', 64, 64, (c) => {
    c.strokeStyle = '#fff'
    c.lineWidth = 2
    c.setLineDash([10, 4])
    c.beginPath()
    c.arc(32, 32, 30, 0, Math.PI * 2)
    c.stroke()
    c.globalAlpha = 0.75
    paw(c, '#fff')
  })
  bake(scene, 'magic-paw-print', 64, 64, (c) => paw(c, '#ff9e39'))
  bake(scene, 'magic-fire-bloom', 64, 64, fireBloom)
  bake(scene, 'aurora-ribbon', 512, 72, (c) => {
    // 뒤쪽 보라색 주름과 앞쪽 비취색 주름은 서로 다른 곡률로 겹친다.
    for (const back of [true, false]) {
      for (let x = 0; x < 512; x++) {
        const u = x / 512
        const { fold, edge, height } = auroraFold(u, back)
        const light = c.createLinearGradient(0, edge - height, 0, edge + 2)
        light.addColorStop(0, back ? '#daaaff00' : '#8bfaff00')
        light.addColorStop(0.42, back ? '#ac74ee90' : '#58c6bd90')
        light.addColorStop(0.75, back ? '#805ce3cb' : '#1dc4adce')
        light.addColorStop(0.92, back ? '#f0c8fffa' : '#a4ffdcfa')
        light.addColorStop(0.97, back ? '#fff0ffef' : '#fff4c7')
        light.addColorStop(1, '#fff4c700')
        c.fillStyle = light
        c.fillRect(x, edge - height, 1, height + 2)
        const filament = Math.sin(112 * u + 9 * fold) ** 8
        if (filament > 0.4) {
          c.strokeStyle = back ? '#f3d6ff70' : '#c2fff68a'
          c.beginPath()
          c.moveTo(x, edge - 2)
          c.quadraticCurveTo(x + 2, edge - 7, x + 7 * fold, edge - height * filament)
          c.stroke()
        }
      }
    }
    // 겹친 비단의 위쪽은 라일락, 아래쪽은 민트빛으로 번진다.
    for (const back of [true, false]) {
      c.beginPath()
      for (let x = 0; x <= 512; x += 2) {
        const u = x / 512
        const y = back ? auroraEdge(u) - 33 - 7 * Math.sin(3 * Math.PI * u) : auroraEdge(u) - 1
        if (x === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.shadowBlur = 9
      c.shadowColor = back ? '#af69ff' : '#4cffe2'
      c.lineWidth = 5
      c.strokeStyle = back ? '#cc8cff88' : '#74ffdf99'
      c.stroke()
      c.shadowBlur = 0
      c.lineWidth = 1.5
      c.strokeStyle = back ? '#ffdcff' : '#e8fff4'
      c.stroke()
    }
    // 망토 자락에 수놓인 별자리도 극광과 함께 펼쳐진다.
    c.strokeStyle = '#fff2cd88'
    c.lineWidth = 0.8
    c.beginPath()
    for (const x of [54, 77, 97, 116, 142]) {
      const y = auroraEdge(x / 512) - 14 - 6 * Math.sin(x)
      if (x === 54) c.moveTo(x, y)
      else c.lineTo(x, y)
      c.fillStyle = '#ffedd1'
      c.fillRect(x - 1.5, y - 1.5, 3, 3)
    }
    c.stroke()
    for (let i = 0; i < 24; i++) {
      const x = (i * 137 + 12) % 512
      const y = auroraEdge(x / 512) - 6 - ((i * 17) % 38)
      const r = i % 4 === 0 ? 3.2 : 1.5
      c.fillStyle = '#fff7da'
      c.beginPath()
      c.moveTo(x, y - r)
      c.quadraticCurveTo(x, y, x + r, y)
      c.quadraticCurveTo(x, y, x, y + r)
      c.quadraticCurveTo(x, y, x - r, y)
      c.quadraticCurveTo(x, y, x, y - r)
      c.fill()
    }
  })
  bake(scene, 'aurora-hem', 96, 38, (c) => {
    const glow = c.createRadialGradient(48, 22, 2, 48, 22, 43)
    glow.addColorStop(0, '#92ffcf99')
    glow.addColorStop(1, '#5effda00')
    c.fillStyle = glow
    c.fillRect(0, 0, 96, 38)
    c.strokeStyle = '#c2ffe4'
    c.shadowColor = '#39ffc9'
    c.shadowBlur = 4
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(11, 15)
    c.bezierCurveTo(-1, 1, 2, 33, 20, 25)
    c.bezierCurveTo(32, 19, 44, 36, 55, 29)
    c.bezierCurveTo(71, 17, 86, 31, 91, 13)
    c.quadraticCurveTo(92, 5, 85, 11)
    c.stroke()
  })
  bake(scene, 'aurora-contact-star', 60, 60, (c) => {
    c.translate(30, 30)
    const halo = c.createRadialGradient(0, 0, 1, 0, 0, 29)
    halo.addColorStop(0, '#fff2ae')
    halo.addColorStop(0.27, '#ffc56b9c')
    halo.addColorStop(1, '#ffcc7200')
    c.fillStyle = halo
    c.fillRect(-30, -30, 60, 60)
    c.fillStyle = '#fff7cd'
    c.beginPath()
    c.moveTo(0, -28)
    c.quadraticCurveTo(2, -2, 24, 0)
    c.quadraticCurveTo(2, 2, 0, 28)
    c.quadraticCurveTo(-2, 2, -24, 0)
    c.quadraticCurveTo(-2, -2, 0, -28)
    c.fill()
  })
  bake(scene, 'aurora-paw', 80, 80, (c) => {
    c.shadowBlur = 8
    c.shadowColor = '#48ffe0'
    c.fillStyle = '#39677fc4'
    c.strokeStyle = '#d0fff1'
    c.lineWidth = 2.6
    c.beginPath()
    c.moveTo(21, 54)
    c.bezierCurveTo(22, 46, 31, 39, 35, 35)
    c.quadraticCurveTo(41, 28, 48, 36)
    c.bezierCurveTo(53, 42, 64, 51, 60, 58)
    c.bezierCurveTo(55, 66, 46, 57, 40, 58)
    c.bezierCurveTo(31, 58, 19, 66, 21, 54)
    c.fill()
    c.stroke()
    for (const [x, y, tilt] of [
      [17, 32, -0.5],
      [31, 21, -0.2],
      [47, 20, 0.2],
      [62, 30, 0.5],
    ]) {
      c.beginPath()
      c.ellipse(x, y, 4, 6, tilt, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      c.fillStyle = '#fff6bb'
      c.fillRect(x - 1, y - 1, 2, 2)
      c.fillStyle = '#39677fc4'
    }
  })
  bake(scene, 'aurora-polar-star', 96, 96, (c) => {
    c.translate(48, 48)
    const halo = c.createRadialGradient(0, 0, 1, 0, 0, 44)
    halo.addColorStop(0, '#fffde9')
    halo.addColorStop(0.22, '#ffe6a8bc')
    halo.addColorStop(0.6, '#bbabff4d')
    halo.addColorStop(1, '#9178ed00')
    c.fillStyle = halo
    c.fillRect(-48, -48, 96, 96)
    c.strokeStyle = '#fff1bf'
    c.lineWidth = 1.4
    for (let i = 0; i < 4; i++) {
      c.beginPath()
      c.arc(0, 0, 25, 0.14, 1.37)
      c.stroke()
      c.rotate(Math.PI / 2)
    }
    c.beginPath()
    for (let i = 0; i < 16; i++) {
      const r = i % 4 === 0 ? 46 : i % 2 === 0 ? 22 : 6
      const a = (Math.PI * i) / 8
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
    c.fillStyle = '#fff6cd'
    c.fill()
    c.strokeStyle = '#b58b59'
    c.stroke()
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(0, 0, 5, 0, Math.PI * 2)
    c.fill()
  })
  for (const spell of EXTRA_SPELLS) {
    if (isArrowSpell(spell)) bake(scene, spellKey(spell), 64, 64, (c) => drawElementArrow(c, spell))
    else if (spell !== 'auroraNight') bake(scene, spellKey(spell), 64, 64, spellSprites[spell])
  }
  if (breakthrough) {
    // 낙하 지점의 중심은 비워 적과 물량 숫자를 계속 볼 수 있게 한다.
    bake(scene, 'magic-landing', 80, 80, (c) => {
      c.translate(40, 40)
      c.strokeStyle = '#fff'
      c.fillStyle = '#fff'
      c.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        c.beginPath()
        c.arc(0, 0, 33, 0.1, Math.PI / 3 - 0.1)
        c.stroke()
        c.beginPath()
        c.moveTo(27, 0)
        c.lineTo(34, -3)
        c.lineTo(38, 0)
        c.lineTo(34, 3)
        c.closePath()
        c.fill()
        c.rotate(Math.PI / 3)
      }
      c.lineWidth = 1
      c.beginPath()
      c.arc(0, 0, 23, 0, Math.PI * 2)
      c.stroke()
    })
  }
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
  // 뿔이 말린 바위 충차. 오른쪽 앞끝을 위로 돌려 들이받는다.
  bake(scene, 'magic-ram', 88 * RAM_ART, 48 * RAM_ART, (c) => {
    c.scale(RAM_ART, RAM_ART)
    c.scale(88 / 64, 48 / 64)
    stoneRam(c)
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
/** boss면 대량 매도벽(50번째 벽마다의 보스, 큰손 벽): 같은 블록을 보라로 물들인 그림이다(빨강은 매수벽 색이라 피한다). */
export const cellKey = (crack: number, boss = false) =>
  boss ? `cell-boss-${crack}` : `cell-${crack}`
/** 대량 매도벽 블록의 색상(hue): 명암과 채도는 보통 블록 그대로 두고 색만 바꾼다. */
const BOSS_WALL_HUE = '#a020f0'

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

export const wallBossKey = (tile: number, frame: number) => `wall-boss-${tile}-${frame}`

/** 현재 보스의 들썩이는 프레임만 기존 64px 적과 같은 해상도로 굽는다. */
export function bakeWallBoss(scene: Phaser.Scene, tile: number) {
  const sheet = scene.textures.get('wall-boss-sheet').getSourceImage() as HTMLImageElement
  const size = sheet.width / 5
  for (let frame = 0; frame < WALK_FRAMES; frame++) {
    bake(scene, wallBossKey(tile, frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
      const bob = Math.sin((frame / WALK_FRAMES) * Math.PI * 2) * 1.2
      c.drawImage(
        sheet,
        (tile % 5) * size,
        Math.floor(tile / 5) * size,
        size,
        size,
        0,
        bob,
        ENEMY_SIZE,
        ENEMY_SIZE,
      )
    })
  }
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
/** redraw면 이미 구운 그림의 수량을 새 배율로 다시 칠한다. */
export function bakeOrders(scene: Phaser.Scene, hpScale = 1, redraw = false) {
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
      bake(
        scene,
        enemyKey(kind as UnitKind, frame),
        ENEMY_SIZE,
        ENEMY_SIZE,
        (c) => {
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
        },
        redraw,
      )
    }
    bake(scene, enemyKey('whale', frame), ENEMY_SIZE, ENEMY_SIZE, (c) => {
      c.save()
      c.translate(0, Math.sin(phase) * 1.2)
      if (scene.textures.exists('vault-guard')) {
        c.drawImage(
          scene.textures.get('vault-guard').getSourceImage() as HTMLImageElement,
          0,
          0,
          ENEMY_SIZE,
          ENEMY_SIZE,
        )
      } else drawWhale(c)
      c.restore()
    })
  }
  // 블록 질감만 교체한다. 균열 단계와 물량 표시는 기존 전투 상태를 따른다.
  const blocks = scene.textures.get('art-wallBlocks').getSourceImage() as HTMLImageElement
  for (let crack = 0; crack < CELL_CRACKS; crack++) {
    bake(scene, cellKey(crack), CELL_TEX.w, CELL_TEX.h, (c) => drawToySellWall(c, blocks, crack))
    // 대량 매도벽: 같은 블록의 색상만 보라로 바꾸고, 빈 자리는 블록 모양대로 다시 비운다.
    bake(scene, cellKey(crack, true), CELL_TEX.w, CELL_TEX.h, (c) => {
      const plain = document.createElement('canvas')
      plain.width = CELL_TEX.w
      plain.height = CELL_TEX.h
      const p = plain.getContext('2d')
      if (!p) return
      drawToySellWall(p, blocks, crack)
      c.save()
      c.drawImage(plain, 0, 0)
      c.globalCompositeOperation = 'hue'
      c.fillStyle = BOSS_WALL_HUE
      c.fillRect(0, 0, CELL_TEX.w, CELL_TEX.h)
      // 한 번에 덮어야 한다: destination-in은 그리는 모양 밖을 모두 지운다.
      c.globalCompositeOperation = 'destination-in'
      c.drawImage(plain, 0, 0)
      c.restore()
    })
  }
  // 벽 뒤 판: 블록 사이를 잇는 옅은 접지 그림자. 위아래 끝의 선은 없앴다 (583번).
  bake(scene, 'wall-band', 64, 32, (c) => {
    c.fillStyle = '#416fa426'
    c.fillRect(0, 0, 64, 32)
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
