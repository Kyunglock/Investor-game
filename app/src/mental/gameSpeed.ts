/**
 * 전투 배속: 예전 빠르기가 너무 빨라 그 절반을 1배로 삼는다. 2배가 예전 빠르기다. 고른 배속은 이 기기에 기억한다.
 */
export const GAME_SPEEDS = [1, 1.5, 2] as const
export type GameSpeed = (typeof GAME_SPEEDS)[number]

/** 1배일 때 실제로 돌리는 빠르기(예전 빠르기 대비). */
export const BASE_SIM_SCALE = 0.5

const KEY = 'mental:game-speed'

/** 배속 → 전투에 넣는 실제 빠르기 배율. */
export function simScale(speed: GameSpeed): number {
  return speed * BASE_SIM_SCALE
}

/** 배속 버튼을 누를 때마다 1 → 1.5 → 2 → 1 로 돈다. */
export function nextGameSpeed(speed: GameSpeed): GameSpeed {
  const i = GAME_SPEEDS.indexOf(speed)
  return GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length]
}

export function loadGameSpeed(): GameSpeed {
  try {
    const n = Number(localStorage.getItem(KEY))
    return (GAME_SPEEDS as readonly number[]).includes(n) ? (n as GameSpeed) : 1
  } catch {
    return 1
  }
}

export function saveGameSpeed(speed: GameSpeed) {
  try {
    localStorage.setItem(KEY, String(speed))
  } catch {
    // 저장이 막혀도 이번 판의 배속은 그대로 쓴다.
  }
}
