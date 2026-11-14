import type { GunGrade } from '@web/features/game/cat/draw'
import { CAT_GUN } from './catGun'
import { spriteBounds } from './stageArt'
import { weaponCell } from './weaponArt'

/** 뒤·위에서 보는 전투 시점. 앞발은 총 아래, 총몸 윗면은 그 위에 그린다. */
export function drawBattleGun(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  grade: GunGrade,
  fur = '#efc58f',
) {
  c.lineCap = 'round'
  c.strokeStyle = fur
  c.lineWidth = 8
  c.beginPath()
  c.moveTo(17, 33)
  c.quadraticCurveTo(20, 39, 27, 40)
  c.moveTo(17, 31)
  c.quadraticCurveTo(25, 25, 39, 24)
  c.stroke()
  for (const [x, y] of [
    [27, 40],
    [39, 24],
  ]) {
    const shade = c.createRadialGradient(x - 2, y - 2, 1, x, y, 6)
    shade.addColorStop(0, '#fff3df')
    shade.addColorStop(1, fur)
    c.fillStyle = shade
    c.beginPath()
    c.ellipse(x, y, 5, 4.5, 0, 0, Math.PI * 2)
    c.fill()
  }
  // 총몸 아래로 가려진 손잡이는 그리지 않는다. 총구 중심은 공통 발사 축에 맞춘다.
  const crop = spriteBounds(source, weaponCell(source, grade))
  const tipX = CAT_GUN.pivotX + CAT_GUN.barrel
  c.drawImage(source, crop.x, crop.y, crop.w, crop.h, 8, CAT_GUN.pivotY - 10, tipX - 8, 20)
}
