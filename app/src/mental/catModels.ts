/** 승인한 총·앞발 일체형 원본. 세 번째 동료도 승인된 두 체형 중 하나를 사용한다. */
export type CatModel = 'hero' | 'fold' | 'fluffy'
export const mateModel = (index: number): CatModel => (index % 2 === 0 ? 'fold' : 'fluffy')

/** drawSprite의 높이 100 배치 안에서 실제 총구 좌표. 꼬리 폭으로 크기를 줄이지 않는다. */
const MUZZLES: Record<CatModel, { x: number; y: number }> = {
  hero: { x: 75, y: 5 },
  fold: { x: 78, y: 5 },
  fluffy: { x: 89, y: 5 },
}

export function catMuzzle(model: CatModel, x: number, y: number) {
  const tip = MUZZLES[model]
  return { x: x + (tip.x - CAT_W / 2) * CAT_SCALE, y: y + (tip.y - CAT_H / 2) * CAT_SCALE }
}

import { CAT_H, CAT_W } from '@web/features/game/cat/draw'

export const CAT_SCALE = 0.72
