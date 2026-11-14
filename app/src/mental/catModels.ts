import { EQUIPPED_MUZZLE, MATE_HOLD } from './weaponArt'

/** 총을 결합할 체형. 실제 몸·눈 그림은 각 고양이의 전용 아틀라스를 쓴다. */
export type CatModel = 'hero' | 'fold' | 'fluffy'
export const mateModel = (index: number): CatModel =>
  index === 0 ? 'fold' : index === 1 || index === 5 ? 'fluffy' : 'hero'

/** drawSprite의 높이 100 배치 안에서 실제 총구 좌표. 꼬리 폭으로 크기를 줄이지 않는다. */
const MUZZLES: Record<CatModel, { x: number; y: number }> = {
  hero: EQUIPPED_MUZZLE,
  fold: MATE_HOLD.fold.muzzle,
  fluffy: MATE_HOLD.fluffy.muzzle,
}

export type CatPose = { rotation?: number; scaleX?: number; scaleY?: number }

export function catMuzzle(model: CatModel, x: number, y: number, pose: CatPose = {}) {
  const tip = MUZZLES[model]
  const dx = (tip.x - CAT_W / 2) * (pose.scaleX ?? CAT_SCALE)
  const dy = (tip.y - CAT_H / 2) * (pose.scaleY ?? CAT_SCALE)
  const angle = pose.rotation ?? 0
  return {
    x: x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: y + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

import { CAT_H, CAT_W } from '@web/features/game/cat/draw'

export const CAT_SCALE = 0.72

/** 탄이 생성되는 실제 총구에서 표적을 겨눈다. 체형마다 총구 위치가 다르다. */
export function catAim(
  model: CatModel,
  x: number,
  y: number,
  target: { x: number; y: number },
  pose: CatPose = {},
) {
  const muzzle = catMuzzle(model, x, y, pose)
  return Math.atan2(target.y - muzzle.y, target.x - muzzle.x)
}
