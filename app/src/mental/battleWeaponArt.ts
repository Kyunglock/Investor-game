import type { GunGrade } from '@web/features/game/cat/draw'
import { CAT_GUN } from './catGun'
import { spriteBounds } from './stageArt'
import { weaponCell } from './weaponArt'

/** 손잡이가 가려지는 총 윗면. 팔과 손은 방향별 고양이 몸 그림에 있다. */
export function drawBattleGun(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  grade: GunGrade,
) {
  // 총몸 아래로 가려진 손잡이는 그리지 않는다. 총구 중심은 공통 발사 축에 맞춘다.
  const crop = spriteBounds(source, weaponCell(source, grade))
  const tipX = CAT_GUN.pivotX + CAT_GUN.barrel
  c.save()
  // 견착한 손 아래로 개머리판이 허리까지 튀어나오지 않게 몸에 가려질 부분을 생략한다.
  c.beginPath()
  c.rect(CAT_GUN.pivotX + 5, 0, CAT_GUN.w, CAT_GUN.h)
  c.clip()
  c.drawImage(source, crop.x, crop.y, crop.w, crop.h, 8, CAT_GUN.pivotY - 9, tipX - 8, 18)
  c.restore()
}
