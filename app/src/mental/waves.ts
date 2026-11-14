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

/**
 * 자동 전투의 몬스터 습격 (decisions.md 500번): 패닉셀·투매·공매도·투기 같은 몬스터는 평소 매도벽의 물량에 섞여 나오지 않고, 이따금 알림과 함께
 * 한 떼씩 몰려온다. 다음 습격까지 45~70초이고 종류는 차례대로 돈다.
 */
export const IDLE_RAID = { first: 30, minGap: 45, maxGap: 70 } as const
export const IDLE_RAID_ORDER = ['panic', 'dump', 'short', 'spec'] as const
export type IdleRaidKind = (typeof IDLE_RAID_ORDER)[number]
/** 습격 알림: 글과 띠 색. */
export const IDLE_RAID_BANNERS: Record<IdleRaidKind, [string, string]> = {
  panic: ['패닉셀이 몰려온다!!', '#e8434f'],
  dump: ['투매가 쏟아진다!!', '#8a6fd6'],
  short: ['공매도 세력이 밀려온다!!', '#44558c'],
  spec: ['투기 세력이 몰려온다!!', '#ea4d6a'],
}

export function idleRaidKind(index: number): IdleRaidKind {
  return IDLE_RAID_ORDER[Math.max(0, Math.floor(index)) % IDLE_RAID_ORDER.length]
}

/** 다음 습격까지 기다릴 시간(초). rand는 0~1. */
export function idleRaidGap(rand: number) {
  const r = Math.min(1, Math.max(0, rand))
  return IDLE_RAID.minGap + r * (IDLE_RAID.maxGap - IDLE_RAID.minGap)
}
