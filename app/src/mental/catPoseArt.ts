import type { CatCode } from '@web/features/raising/store'
import { drawCatOutfit } from './catOutfitArt'
import { catPoseCell } from './catPose'
import { rosterCell } from './catRoster'
import { drawSprite } from './stageArt'

/** 팔·손·눈·꼬리는 각 고양이의 자세 원본에 포함된다. 총만 이 그림 뒤에 합성한다. */
export function drawCatPose(
  c: CanvasRenderingContext2D,
  source: HTMLImageElement,
  index: number,
  roster?: { code: CatCode; atlas: number; slot: number },
) {
  // 봄꽃냥은 몸만 흰 털과 은빛 줄무늬로 칠하고 꽃옷은 원래 색으로 합성한다.
  const whiteFur = roster?.code === 'flora'
  if (whiteFur) {
    c.save()
    c.filter = 'grayscale(1) brightness(1.18)'
  }
  drawSprite(
    c,
    source,
    roster === undefined
      ? catPoseCell(source, index)
      : rosterCell(source, roster.atlas, roster.slot, index),
    { x: 14, y: 3, w: 75, h: 100 },
    'height',
  )
  if (whiteFur) c.restore()
  if (roster) drawCatOutfit(c, roster.code, index)
}
