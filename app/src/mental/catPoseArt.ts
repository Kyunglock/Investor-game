import { catPoseCell } from './catPose'
import { drawSprite } from './stageArt'

/** 팔·손·눈·꼬리는 각 고양이의 자세 원본에 포함된다. 총만 이 그림 뒤에 합성한다. */
export function drawCatPose(c: CanvasRenderingContext2D, source: HTMLImageElement, index: number) {
  drawSprite(c, source, catPoseCell(source, index), { x: 14, y: 3, w: 75, h: 100 }, 'height')
}
