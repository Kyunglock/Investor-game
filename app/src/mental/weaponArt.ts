import { GUN_GRADES, type GunGrade } from '@web/features/game/cat/draw'
import { drawSprite, spriteBounds } from './stageArt'

/** C안 원본 아틀라스: 왼쪽부터 F~LR, 4열 × 3행. 아이콘과 장착 모습이 같은 원본을 쓴다. */
export function weaponCell(source: HTMLImageElement, grade: GunGrade) {
  const index = GUN_GRADES.indexOf(grade)
  const w = source.width / 4
  const h = source.height / 3
  return { x: (index % 4) * w, y: Math.floor(index / 4) * h, w, h }
}

export function drawInventoryGun(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  grade: GunGrade,
  target = { x: 0, y: 0, w: 96, h: 72 },
) {
  drawSprite(c, source, weaponCell(source, grade), target)
}

/** 총구와 조준·탄 생성의 공통 기준점. 손의 위치에 맞춰 총만 합성한다. */
export const EQUIPPED_MUZZLE = { x: 75, y: 5 }
export function drawEquippedHero(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  weapons: HTMLImageElement,
  grade: GunGrade,
) {
  const body = () =>
    drawSprite(
      c,
      source,
      { x: 0, y: 0, w: source.width, h: source.height },
      { x: 14, y: 3, w: 75, h: 100 },
      'height',
    )
  body()
  const crop = spriteBounds(weapons, weaponCell(weapons, grade))
  c.save()
  c.translate(EQUIPPED_MUZZLE.x, EQUIPPED_MUZZLE.y)
  c.rotate(-Math.PI / 2 + 0.3)
  c.drawImage(weapons, crop.x, crop.y, crop.w, crop.h, -57, -12, 57, 34)
  c.restore()
  // 원본 앞발을 총 위에 다시 얹어 손잡이와 앞 총몸을 잡게 한다.
  c.save()
  c.beginPath()
  c.ellipse(81, 38, 4.5, 5.8, 0.35, 0, Math.PI * 2)
  c.ellipse(75, 57, 4.5, 5.8, 0.35, 0, Math.PI * 2)
  c.clip()
  body()
  c.restore()
}

/**
 * 동료 고양이가 무기를 드는 자리 (511번): drawSprite의 높이 100 배치 안에서 총구와 두 앞발. 원본 그림의 총은 마스크로 지우고 그 자리에 든
 * 무기를 얹는다. 총구는 catModels의 MUZZLES와 같은 값이다.
 */
export const MATE_HOLD = {
  fold: {
    muzzle: { x: 72, y: 5 },
    paws: [
      { x: 82, y: 40 },
      { x: 74.5, y: 58.5 },
    ],
  },
  fluffy: {
    muzzle: { x: 82, y: 5 },
    paws: [
      { x: 93.4, y: 38.7 },
      { x: 85, y: 56.5 },
    ],
  },
} as const

const MATE_TARGET = { x: 14, y: 3, w: 75, h: 100 }
const MATE_GUN_SCALE = 0.9

/**
 * 동료 고양이에게 든 무기를 얹어 그린다 (511번). 원본(source)에는 총이 그려져 있어, 총 자리 마스크(mask)로 총을 지운 몸에 무기 그림을 얹고
 * 앞발을 다시 덮는다. tint가 있으면 몸에만 입힌다: 총은 제 빛깔 그대로다.
 */
export function drawEquippedMate(
  c: CanvasRenderingContext2D,
  model: keyof typeof MATE_HOLD,
  source: HTMLImageElement,
  mask: HTMLImageElement,
  weapons: HTMLImageElement,
  grade: GunGrade,
  size: { w: number; h: number },
  tint?: number,
) {
  const k = c.getTransform().a
  const layer = () => {
    const cv = document.createElement('canvas')
    cv.width = Math.ceil(size.w * k)
    cv.height = Math.ceil(size.h * k)
    const ctx = cv.getContext('2d')
    ctx?.scale(k, k)
    return ctx
  }
  const bare = layer()
  if (!bare) return
  const cell = { x: 0, y: 0, w: source.width, h: source.height }
  drawSprite(bare, source, cell, MATE_TARGET, 'height')
  // 마스크는 원본과 같은 크기라, 원본의 그림 영역과 같은 자리에 겹친다.
  const crop = spriteBounds(source, cell)
  const scale = MATE_TARGET.h / crop.h
  bare.globalCompositeOperation = 'destination-out'
  bare.drawImage(
    mask,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    MATE_TARGET.x + (MATE_TARGET.w - crop.w * scale) / 2,
    MATE_TARGET.y,
    crop.w * scale,
    crop.h * scale,
  )
  if (tint !== undefined) {
    const shade = layer()
    if (shade) {
      shade.fillStyle = `#${tint.toString(16).padStart(6, '0')}`
      shade.fillRect(0, 0, size.w, size.h)
      shade.globalCompositeOperation = 'destination-in'
      shade.drawImage(bare.canvas, 0, 0, size.w, size.h)
      bare.globalCompositeOperation = 'multiply'
      bare.drawImage(shade.canvas, 0, 0, size.w, size.h)
    }
  }
  const body = () => c.drawImage(bare.canvas, 0, 0, size.w, size.h)
  body()
  const hold = MATE_HOLD[model]
  const gun = spriteBounds(weapons, weaponCell(weapons, grade))
  c.save()
  c.translate(hold.muzzle.x, hold.muzzle.y)
  c.rotate(-Math.PI / 2)
  c.scale(MATE_GUN_SCALE, MATE_GUN_SCALE)
  c.drawImage(weapons, gun.x, gun.y, gun.w, gun.h, -57, -12, 57, 34)
  c.restore()
  // 원본 앞발을 총 위에 다시 얹어 손잡이를 잡게 한다.
  c.save()
  c.beginPath()
  for (const paw of hold.paws) c.ellipse(paw.x, paw.y, 5, 6.2, 0.35, 0, Math.PI * 2)
  c.clip()
  body()
  c.restore()
}
