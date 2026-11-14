import type { GunGrade } from '@web/features/game/cat/draw'
import { CAT_GUN } from './catGun'
import { spriteBounds } from './stageArt'
import { weaponCell } from './weaponArt'

/** 위에서 본 총. 머리·어깨·팔 아래에 그려 견착한 총열 앞쪽을 드러낸다. */
export function drawBattleGun(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  grade: GunGrade,
) {
  const crop = spriteBounds(source, weaponCell(source, grade))
  const tipX = CAT_GUN.pivotX + CAT_GUN.barrel
  c.drawImage(source, crop.x, crop.y, crop.w, crop.h, 8, CAT_GUN.pivotY - 10, tipX - 8, 20)
}
