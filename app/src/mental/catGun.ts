import { CAT_SCALE, type CatModel } from './catModels'
import { catPoseAngle, catPoseIndex } from './catPose'

/** 무기 그림은 오른쪽을 향하며, 총구는 어깨 축에서 70px 앞이다. */
export const CAT_GUN = { w: 104, h: 64, pivotX: 20, pivotY: 32, barrel: 70 }
const SHOULDERS: Record<CatModel, { x: number; y: number }> = {
  hero: { x: 73, y: 65 },
  fold: { x: 73, y: 65 },
  fluffy: { x: 82, y: 65 },
}

export function catShoulder(model: CatModel, x: number, y: number) {
  const p = SHOULDERS[model]
  return { x: x + (p.x - 50) * CAT_SCALE, y: y + (p.y - 55) * CAT_SCALE }
}

/** 자세에 그려진 손 안쪽을 통과하는 총. 뒤쪽 개머리판은 몸으로 가린다. */
export function catGunPose(model: CatModel, x: number, y: number, aim: number, kick = 0) {
  const index = catPoseIndex(aim)
  const angle = catPoseAngle(index)
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const left = index < 4
  const gripX = left ? (model === 'fluffy' ? 22 : 25) : model === 'fluffy' ? 81 : 78
  const gripY = left ? 53 : 58
  const recoil = Math.max(0, Math.min(1.5, kick)) * 2.4
  const origin = {
    x: x + (gripX - 50 - dx * 15) * CAT_SCALE - dx * recoil,
    y: y + (gripY - 55 - dy * 15) * CAT_SCALE - dy * recoil,
  }
  return {
    ...origin,
    angle,
    index,
    muzzle: {
      x: origin.x + dx * CAT_GUN.barrel * CAT_SCALE,
      y: origin.y + dy * CAT_GUN.barrel * CAT_SCALE,
    },
  }
}

/** 15도 간격의 그림과 별개로, 탄은 실제 총구에서 원래 표적에 도달한다. */
export function catShotAngle(muzzle: { x: number; y: number }, target: { x: number; y: number }) {
  return Math.atan2(target.y - muzzle.y, target.x - muzzle.x)
}

export function catGunAim(model: CatModel, x: number, y: number, target: { x: number; y: number }) {
  const shoulder = catShoulder(model, x, y)
  return Math.atan2(target.y - shoulder.y, target.x - shoulder.x)
}
