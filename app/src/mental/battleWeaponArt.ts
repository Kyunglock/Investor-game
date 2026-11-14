import type { GunGrade } from '@web/features/game/cat/draw'
import { CAT_GUN } from './catGun'
import { spriteBounds } from './stageArt'
import { weaponCell } from './weaponArt'

/** 기존 측면 총. 몸보다 먼저 그려 옆으로 나온 총열 끝만 보이게 한다. */
export function drawBattleGun(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  grade: GunGrade,
) {
  const crop = spriteBounds(source, weaponCell(source, grade))
  const tipX = CAT_GUN.pivotX + CAT_GUN.barrel
  c.drawImage(source, crop.x, crop.y, crop.w, crop.h, 8, CAT_GUN.pivotY - 9.6, tipX - 8, 24)
}
