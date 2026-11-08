import { ENEMIES, type EnemyKind } from './enemies'

export const WALK_FRAMES = 8

/** 두 발을 한 번씩 내딛는 거리. 속도가 빠른 적은 발걸음도 빨라진다. */
const STRIDE: Record<EnemyKind, number> = { panic: 48, dump: 38, spec: 32, stop: 42 }

export function walkFrame(kind: EnemyKind, ageSeconds: number, offset: number, reduced = false) {
  if (reduced) return 0
  return (
    Math.floor(
      (Math.max(0, ageSeconds) * ENEMIES[kind].speed * WALK_FRAMES) / STRIDE[kind] + offset,
    ) % WALK_FRAMES
  )
}

/** 그림 안에서만 움직여 물리 몸체와 이동 경로를 흔들지 않는다. */
export function walkPose(kind: EnemyKind, frame: number) {
  const phase = ((frame % WALK_FRAMES) * Math.PI * 2) / WALK_FRAMES
  const step = Math.sin(phase)
  const lift = Math.abs(step)
  const weight = kind === 'spec' ? 0.65 : kind === 'panic' ? 1.15 : 1
  return {
    tilt: step * 0.07 * weight,
    bob: -lift * 2.5 * weight,
    squash: 1 - lift * 0.035 * weight,
    leftFoot: step * 0.32,
    rightFoot: -step * 0.32,
    shadow: 1 - lift * 0.12,
  }
}
