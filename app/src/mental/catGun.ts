import { CAT_SCALE, type CatModel } from './catModels'

/** 고양이(깊이 5)가 무기·총구 화염·갓 발사된 탄을 가린다. */
export const CAT_GUN_DEPTH = 4.8
export const CAT_SHOT_DEPTH = 4.9
/** 무기 그림은 오른쪽을 향하며, 총구는 몸 앞의 지지점에서 40px 앞이다. */
export const CAT_GUN = { w: 80, h: 64, pivotX: 20, pivotY: 32, barrel: 40 }
export const CAT_SHOULDER_ANGLE = (-Math.PI * 2) / 9
const HOLDS: Record<CatModel, { x: number; y: number }> = {
  hero: { x: 68, y: 61 },
  fold: { x: 68, y: 61 },
  fluffy: { x: 68, y: 61 },
}

export function catShoulder(model: CatModel, x: number, y: number) {
  const p = HOLDS[model]
  return { x: x + (p.x - 50) * CAT_SCALE, y: y + (p.y - 55) * CAT_SCALE }
}

/** 총은 어깨와 두 손에 붙은 견착 자세를 유지하고 총열 방향으로만 반동한다. */
export function catGunPose(model: CatModel, x: number, y: number, kick = 0) {
  const angle = CAT_SHOULDER_ANGLE
  const shoulder = catShoulder(model, x, y)
  const recoil = Math.max(0, Math.min(1.5, kick)) * 2.4
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const origin = { x: shoulder.x - dx * recoil, y: shoulder.y - dy * recoil }
  return {
    ...origin,
    angle,
    muzzle: {
      x: origin.x + dx * CAT_GUN.barrel * CAT_SCALE,
      y: origin.y + dy * CAT_GUN.barrel * CAT_SCALE,
    },
  }
}

/** 반동이 적용된 실제 총구에서 표적까지의 탄환 진행 방향. */
export function catGunAim(
  model: CatModel,
  x: number,
  y: number,
  target: { x: number; y: number },
  kick = 0,
) {
  const { muzzle } = catGunPose(model, x, y, kick)
  return Math.atan2(target.y - muzzle.y, target.x - muzzle.x)
}
