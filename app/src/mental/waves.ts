/** 15초마다 패닉셀 → 투매 → 공매도. 투기 몹은 일반 생성으로 계속 등장한다. */
export const WAVE_ORDER = ['panic', 'dump', 'short'] as const
export function waveKind(index: number) {
  return WAVE_ORDER[Math.max(0, Math.floor(index)) % WAVE_ORDER.length]
}

/**
 * 웨이브 판 (decisions.md 690번): 메인 화면의 스테이지는 시간을 버티지 않고 몬스터 웨이브를 차례로 물리친다. 웨이브 하나는 떼(패닉셀 → 투매 →
 * 공매도 순)와 그 뒤를 잇는 몬스터 줄기다. 화면의 몬스터를 다 잡으면(또는 멘탈벽에 닿아 터지면) 잠깐 쉬고 다음 웨이브가 온다.
 */
export const STAGE_WAVE = {
  /** 판이 시작되고 첫 웨이브까지(초). */
  first: 1,
  /** 웨이브를 다 물리친 뒤 다음 웨이브까지 쉬는 시간(초). */
  rest: 1.5,
  /** 줄기가 쏟아지는 시간(초): 시간 판(363번)이 이만큼 동안 내던 몬스터가 한 웨이브의 줄기다. */
  pour: 10,
} as const

/** 웨이브가 판의 어디쯤인가(0~1): 첫 웨이브가 0, 마지막이 1. */
export function waveProgress(at: number, total: number): number {
  return total <= 1 ? 1 : Math.min(1, Math.max(0, (at - 1) / (total - 1)))
}

/** 웨이브 판에서 난이도 곡선의 시각(초, 예전 4분 판 기준): 마지막 웨이브에 곡선의 끝(240초)에 닿는다. */
export function waveCurve(at: number, total: number): number {
  return waveProgress(at, total) * 240
}

/**
 * 한 웨이브의 줄기에 나오는 몬스터 수: 시간 판의 생성 간격(700ms에서 200ms까지 줄어든다)으로 STAGE_WAVE.pour초 동안 나오던 만큼. countScale은 그
 * 웨이브에 걸린 적 수 배율이다.
 */
export function waveStreamCount(at: number, total: number, countScale: number): number {
  const every = Math.max(200, 700 - waveCurve(at, total) * 2.6) / Math.max(0.1, countScale)
  return Math.max(1, Math.round((STAGE_WAVE.pour * 1000) / every))
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
