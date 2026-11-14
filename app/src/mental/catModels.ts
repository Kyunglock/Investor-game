import { EQUIPPED_MUZZLE, MATE_HOLD } from './weaponArt'

/** 사장냥과 동료 모두 든 무기를 합성한다(동료는 원본의 총을 지우고 얹는다, 511번). 세 번째 동료도 승인된 두 체형 중 하나를 사용한다. */
export type CatModel = 'hero' | 'fold' | 'fluffy'
export const mateModel = (index: number): CatModel => (index % 2 === 0 ? 'fold' : 'fluffy')

/** drawSprite의 높이 100 배치 안에서 실제 총구 좌표. 꼬리 폭으로 크기를 줄이지 않는다. */
const MUZZLES: Record<CatModel, { x: number; y: number }> = {
  hero: EQUIPPED_MUZZLE,
  fold: MATE_HOLD.fold.muzzle,
  fluffy: MATE_HOLD.fluffy.muzzle,
}

export function catMuzzle(model: CatModel, x: number, y: number) {
  const tip = MUZZLES[model]
  return { x: x + (tip.x - CAT_W / 2) * CAT_SCALE, y: y + (tip.y - CAT_H / 2) * CAT_SCALE }
}

import { CAT_H, CAT_W } from '@web/features/game/cat/draw'

export const CAT_SCALE = 0.72

/** 탄이 생성되는 실제 총구에서 표적을 겨눈다. 체형마다 총구 위치가 다르다. */
export function catAim(model: CatModel, x: number, y: number, target: { x: number; y: number }) {
  const muzzle = catMuzzle(model, x, y)
  return Math.atan2(target.y - muzzle.y, target.x - muzzle.x)
}
