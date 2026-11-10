/** 15초마다 패닉셀 → 투매 → 공매도. 투기 몹은 일반 생성으로 계속 등장한다. */
export const WAVE_ORDER = ['panic', 'dump', 'short'] as const
export function waveKind(index: number) {
  return WAVE_ORDER[Math.max(0, Math.floor(index)) % WAVE_ORDER.length]
}
