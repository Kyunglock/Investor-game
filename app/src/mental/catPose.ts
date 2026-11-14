/** 화면 위쪽이 0도. 몸을 회전시키지 않고 승인된 아홉 견착 자세를 선택한다. */
export const CAT_POSE_DEGREES = [-60, -45, -30, -15, 0, 15, 30, 45, 60] as const

export function catPoseIndex(aim: number) {
  const relative = Math.atan2(Math.sin(aim + Math.PI / 2), Math.cos(aim + Math.PI / 2))
  const degrees = (relative * 180) / Math.PI
  return Math.round((Math.max(-60, Math.min(60, degrees)) + 60) / 15)
}

export function catPoseAngle(index: number) {
  return ((CAT_POSE_DEGREES[index] - 90) * Math.PI) / 180
}

export function catPoseCell(source: { width: number; height: number }, index: number) {
  const w = source.width / 3
  const h = source.height / 3
  return { x: (index % 3) * w, y: Math.floor(index / 3) * h, w, h }
}
