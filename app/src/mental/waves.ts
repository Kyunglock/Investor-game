/** 15초마다 패닉셀 → 투매 → 공매도. 투기 몹은 일반 생성으로 계속 등장한다. */
export const WAVE_ORDER = ['panic', 'dump', 'short'] as const
export function waveKind(index: number) {
  return WAVE_ORDER[Math.max(0, Math.floor(index)) % WAVE_ORDER.length]
}

/** 패닉셀 러시: 정해진 파도와 따로, 판 중간중간 갑자기 패닉셀이 몰려온다. 다음 러시까지 22~34초. */
export const PANIC_RUSH = {
  minGap: 22,
  maxGap: 34,
  /** 첫 러시는 판 시작 후 이 시각(초) 뒤에야 온다. */
  first: 20,
  /** 러시 한 번이 이어지는 시간(초)과 이 동안 쏟아지는 패닉셀 수(공격 판은 60%). */
  seconds: 2.4,
  count: 30,
  /** 정해진 파도와 이 초 안으로 겹치면 미룬다. */
  waveGuard: 3,
} as const

/** 다음 패닉셀 러시까지 기다릴 시간(초). rand는 0~1. */
export function panicRushGap(rand: number) {
  const r = Math.min(1, Math.max(0, rand))
  return PANIC_RUSH.minGap + r * (PANIC_RUSH.maxGap - PANIC_RUSH.minGap)
}
