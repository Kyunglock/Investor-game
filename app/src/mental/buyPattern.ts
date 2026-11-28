import { buyOrderX } from './buyWall'

/**
 * 매수 주문(매수 티켓)이 날아가는 패턴 (decisions.md 712번): 출전 탭에서 고른다. 어디에서 떠서 어떻게 날아가는지만 다르고 수량·장수는 같다.
 * 고른 패턴은 이 기기에 저장한다(서버는 모른다).
 */
export const BUY_PATTERNS = [
  { code: 'sides', name: '양옆', note: '양쪽 끝에서 많이, 가운데는 조금' },
  { code: 'line', name: '일자', note: '가로 한 줄로 나란히' },
  { code: 'stairs', name: '계단', note: '왼쪽부터 한 칸씩 올라가는 계단' },
  { code: 'pillars', name: '양쪽 기둥', note: '양쪽 두 줄로 곧게' },
  { code: 'wedge', name: '쐐기', note: '가운데가 앞서는 V자' },
  { code: 'center', name: '가운데', note: '가운데로 모아서' },
  { code: 'even', name: '고르게', note: '벽 전체에서 고르게' },
  { code: 'sweep', name: '훑기', note: '왼쪽에서 오른쪽으로 차례로' },
  { code: 'wave', name: '물결', note: '좌우로 흔들리며' },
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

/** 계단·쐐기에서 한 칸 뒤의 주문이 처지는 거리(px): 그 거리를 날아갈 시간만큼 늦게 출발한다 (713번). */
export const STEP_BEHIND = 14

/** 일자·계단의 칸 수, 일자가 칸을 채우는 차례(세 장이 한 줄에 고르게 서고 다음 세 장이 그 사이를 채운다), 쐐기의 자리. */
const COLUMNS = 6
const LINE_ORDER = [0, 2, 4, 1, 3, 5]
const WEDGE = [
  { at: 0.5, rank: 2 },
  { at: 0.3, rank: 1 },
  { at: 0.7, rank: 1 },
  { at: 0.1, rank: 0 },
  { at: 0.9, rank: 0 },
]

export interface BuyLaunch {
  x: number
  /** 물결: 날아가는 동안 이 폭(px)으로 좌우로 흔들린다. 0이면 곧게 간다. */
  sway: number
  phase: number
  /** 계단·쐐기: 맨 앞 주문보다 이만큼(px) 처진다. 앞에서 출발하지 않고 그 거리만큼 늦게 뜬다 (713번). */
  behind: number
}

/**
 * index번째 매수 주문이 뜨는 자리와 모양. 레인의 양 끝 8%는 비워 둔다: 주문서가 벽 밖으로 나가지 않는다.
 */
export function buyLaunch(
  pattern: BuyPattern,
  left: number,
  width: number,
  index: number,
  random: () => number = Math.random,
): BuyLaunch {
  const at = (ratio: number) => left + width * (0.08 + 0.84 * Math.min(1, Math.max(0, ratio)))
  const straight = (x: number, behind = 0): BuyLaunch => ({ x, sway: 0, phase: 0, behind })
  const turn = (n: number) => ((index % n) + n) % n
  switch (pattern) {
    case 'line':
      return straight(at((LINE_ORDER[turn(COLUMNS)] + 0.5) / COLUMNS))
    case 'stairs': {
      const col = turn(COLUMNS)
      // 오른쪽 끝이 맨 앞이다: 왼쪽으로 갈수록 한 칸씩 늦게 뜬다.
      return straight(at((col + 0.5) / COLUMNS), (COLUMNS - 1 - col) * STEP_BEHIND)
    }
    case 'pillars':
      return straight(at(turn(2) === 0 ? 0.12 : 0.88))
    case 'wedge': {
      const spot = WEDGE[turn(WEDGE.length)]
      // 가운데(rank 2)가 맨 앞이고 바깥으로 갈수록 늦게 뜬다.
      return straight(at(spot.at), (2 - spot.rank) * STEP_BEHIND * 1.5)
    }
    case 'even':
      return straight(at(random()))
    case 'center':
      // 두 난수의 평균이라 가운데에 몰린다. 폭은 레인의 가운데 40%.
      return straight(at(0.3 + 0.4 * ((random() + random()) / 2)))
    case 'sweep': {
      const step = turn(SWEEP_SHOTS)
      const half = SWEEP_SHOTS / 2
      return straight(at(step <= half ? step / half : (SWEEP_SHOTS - step) / half))
    }
    case 'wave':
      // 흔들려도 레인 안에 머물도록 가운데 쪽에서 띄운다. 번갈아 반대쪽으로 흔들린다.
      return {
        x: at(0.14 + 0.72 * random()),
        sway: width * WAVE_SWAY,
        phase: turn(2) === 0 ? 0 : Math.PI,
        behind: 0,
      }
    default:
      return straight(buyOrderX(left, width, random))
  }
}

/**
 * 패턴 미리 보기 (출전 탭): 폭 100 · 높이 60의 그림에 주문 열두 장의 자리를 찍는다. 세 장이 한 번에 뜨고(BUY_WALL.shotsPerSell)
 * 먼저 뜬 것이 위에 있다. 난수는 고정이라 볼 때마다 같은 그림이다.
 */
export function buyPatternPreview(pattern: BuyPattern): { x: number; y: number }[] {
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const shots = 12
  // 한 묶음의 장수: 계단은 여섯 장, 쐐기는 다섯 장이 한 모양을 이루고, 나머지는 한 번에 뜨는 세 장이다.
  const group =
    pattern === 'stairs'
      ? COLUMNS
      : pattern === 'wedge'
        ? WEDGE.length
        : pattern === 'pillars'
          ? 2
          : 3
  const last = Math.floor((shots - 1) / group)
  const gap = (13 * group) / 3
  const list = Array.from({ length: shots }, (_, i) => buyLaunch(pattern, 0, 100, i, random))
  // 가장 처진 주문을 바닥에 두고, 덜 처진 주문일수록 위에 그린다(그림의 비율로 줄여서).
  const most = Math.max(...list.map((shot) => shot.behind))
  return list.map((shot, i) => {
    const round = Math.floor(i / group)
    // 먼저 뜬 묶음일수록 위로 올라가 있다.
    const y = 52 - (last - round) * gap - (most - shot.behind) * 0.28
    const x = shot.x + (shot.sway > 0 ? Math.sin((last - round) * 1.6 + shot.phase) * shot.sway : 0)
    return { x, y: Math.max(4, y) }
  })
}
