import { buyOrderX } from './buyWall'

/**
 * 매수 주문(매수 티켓)이 날아가는 패턴 (decisions.md 712번): 출전 탭에서 고른다. 어디에서 떠서 어떻게 날아가는지만 다르고 수량·장수는 같다.
 * 고른 패턴은 이 기기에 저장한다(서버는 모른다).
 */
export const BUY_PATTERNS = [
  { code: 'sides', name: '양옆', note: '양쪽 끝에서 많이, 가운데는 조금' },
  { code: 'even', name: '고르게', note: '벽 전체에서 고르게' },
  { code: 'center', name: '가운데', note: '가운데로 모아서' },
  { code: 'sweep', name: '훑기', note: '왼쪽에서 오른쪽으로 차례로 훑어요' },
  { code: 'wave', name: '물결', note: '좌우로 흔들리며 날아가요' },
] as const
export type BuyPattern = (typeof BUY_PATTERNS)[number]['code']

const KEY = 'buy-pattern'
const known = (code: unknown): code is BuyPattern => BUY_PATTERNS.some((p) => p.code === code)

/** 고른 패턴. 고른 적이 없거나 읽을 수 없으면 전부터 쓰던 양옆이다. */
export function loadBuyPattern(): BuyPattern {
  try {
    const raw = localStorage.getItem(KEY)
    return known(raw) ? raw : 'sides'
  } catch {
    return 'sides'
  }
}

export function saveBuyPattern(pattern: BuyPattern) {
  try {
    localStorage.setItem(KEY, pattern)
  } catch {
    // 저장하지 못해도 이번에는 그대로 쓴다.
  }
}

/** 훑기 한 번(왼쪽 끝 → 오른쪽 끝 → 왼쪽 끝)에 드는 장수. */
const SWEEP_SHOTS = 16
/** 물결의 좌우 폭(레인 폭에 대한 비율)과 빠르기(전투 초당 라디안). */
export const WAVE_SWAY = 0.09
export const WAVE_SPEED = 7

/**
 * index번째 매수 주문이 뜨는 자리와 흔들림. sway가 0보다 크면 날아가는 동안 그 폭(px)으로 좌우로 흔들린다(물결).
 * 레인의 양 끝 8%는 비워 둔다: 주문서가 벽 밖으로 나가지 않는다.
 */
export function buyLaunch(
  pattern: BuyPattern,
  left: number,
  width: number,
  index: number,
  random: () => number = Math.random,
): { x: number; sway: number; phase: number } {
  const at = (ratio: number) => left + width * (0.08 + 0.84 * Math.min(1, Math.max(0, ratio)))
  switch (pattern) {
    case 'even':
      return { x: at(random()), sway: 0, phase: 0 }
    case 'center':
      // 두 난수의 평균이라 가운데에 몰린다. 폭은 레인의 가운데 40%.
      return { x: at(0.3 + 0.4 * ((random() + random()) / 2)), sway: 0, phase: 0 }
    case 'sweep': {
      const step = ((index % SWEEP_SHOTS) + SWEEP_SHOTS) % SWEEP_SHOTS
      const half = SWEEP_SHOTS / 2
      return { x: at(step <= half ? step / half : (SWEEP_SHOTS - step) / half), sway: 0, phase: 0 }
    }
    case 'wave':
      // 흔들려도 레인 안에 머물도록 가운데 쪽에서 띄운다. 번갈아 반대쪽으로 흔들린다.
      return {
        x: at(0.14 + 0.72 * random()),
        sway: width * WAVE_SWAY,
        phase: index % 2 === 0 ? 0 : Math.PI,
      }
    default:
      return { x: buyOrderX(left, width, random), sway: 0, phase: 0 }
  }
}
