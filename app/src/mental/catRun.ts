export const CAT_RUN_FRAMES = 8

export function catRunFrame(seconds: number, offset = 0, rushing = false, reduced = false) {
  if (reduced) return 0
  return Math.floor(Math.max(0, seconds) * (rushing ? 32 : 19) + offset * 3) % CAT_RUN_FRAMES
}

/** Only the drawing moves; firing origins and collision bodies keep their existing positions. */
export function catRunPose(frame: number) {
  const step = Math.sin((frame / CAT_RUN_FRAMES) * Math.PI * 2)
  return {
    bob: -Math.abs(step) * 3.5,
    lean: step * 0.035,
    left: step * 0.25,
    right: -step * 0.25,
  }
}

export const catRunKey = (base: string, frame: number) => `${base}-run-${frame}`
