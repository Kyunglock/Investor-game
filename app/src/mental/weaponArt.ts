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
