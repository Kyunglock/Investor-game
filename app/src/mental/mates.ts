import { NEW_CATS } from './catRoster'

/** 고양이 카드의 정체성을 전투에서도 유지한다. 각 동료는 눈·털·귀가 다른 전용 9방향 그림을 쓴다. */
export const MATE_LOOKS = [
  { color: '#5fb4ff', name: '하늘냥', poses: 'skyPoses' },
  { color: '#3fcf9a', name: '민트냥', poses: 'mintPoses' },
  { color: '#b98cff', name: '라일락냥', poses: 'lilacPoses' },
  { color: '#ff9d5c', name: '노을냥', poses: 'sunsetPoses' },
  { color: '#5b6388', name: '밤냥', poses: 'nightPoses' },
  { color: '#bfe6ff', name: '눈꽃냥', poses: 'snowPoses' },
  ...NEW_CATS.map((cat) => ({
    code: cat.code,
    color: cat.color,
    name: cat.name,
    poses: `roster${cat.atlas}`,
    slot: cat.slot,
    atlas: cat.atlas,
  })),
] as const

/** 고양이 사이의 가장 넓은 간격(px)과 화면 양쪽에 남길 틈(px). */
export const MATE_GAP = 84
export const MATE_MARGIN = 22

/**
 * 멘탈벽 뒤 한 줄로 늘어선 자리(가운데에서 x 차이, px). 0번이 사장냥, 1번부터 들어온 차례의 고양이다. 줄 전체가 가운데에 오고, 사장냥은 가운데(짝수면
 * 가운데 왼쪽)에 선다. 고양이는 오른쪽 옆, 왼쪽 옆, 그다음 오른쪽 끝 순으로 붙는다. 간격은 화면 폭에 맞춰 좁아진다(320px에 넷이면 69px).
 */
export function mateFormation(count: number, width: number, ordered = false): number[] {
  const n = Math.max(1, count)
  const gap = Math.min(MATE_GAP, Math.max(0, width - MATE_MARGIN * 2) / n)
  const slot = (k: number) => (k - (n - 1) / 2) * gap
  // 자동 전투 (599번): 출전 칸에 놓은 차례 그대로 왼쪽부터 선다. 사장냥이 맨 왼쪽이다.
  if (ordered) return Array.from({ length: n }, (_, k) => slot(k))
  const hero = Math.floor((n - 1) / 2)
  // 사장냥 자리에서 오른쪽·왼쪽으로 번갈아 넓혀 간다.
  const order: number[] = []
  for (let d = 1; order.length < n - 1; d++) {
    if (hero + d < n) order.push(hero + d)
    if (hero - d >= 0 && order.length < n - 1) order.push(hero - d)
  }
  return [slot(hero), ...order.map(slot)]
}

/** 화면(폭 w · 높이 h)에 보이는 자리인가 (715번): 디펜스 스테이지의 총은 보이는 적이면 거리와 상관없이 노린다. */
export function inSight(p: { x: number; y: number }, w: number, h: number): boolean {
  return p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h
}

/**
 * 고양이마다 다른 적을 노린다 (409번): 393번에서는 모두 사장냥이 노리는 한 적을 쏴 한 마리에 탄이 몰렸다. 사장냥 총에서 range 안의 가까운 적을
 * 쏘는 수(shooters.length)만큼 고르고, 사장냥(0번)부터 차례로 저에게 가장 가까운 아직 안 맡은 적을 맡는다. 적이 쏘는 수보다 적으면 남는 고양이는
 * 그 가운데 저에게 가장 가까운 적을 함께 쏜다. 적이 없으면 모두 null.
 */
export function spreadTargets<T extends { x: number; y: number }>(
  shooters: readonly { x: number; y: number }[],
  enemies: readonly T[],
  range: number,
): (T | null)[] {
  if (shooters.length === 0) return []
  const lead = shooters[0]
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2
  const near = enemies
    .map((e) => ({ e, d: dist(lead, e) }))
    .filter((c) => c.d < range * range)
    .sort((a, b) => a.d - b.d)
    .slice(0, shooters.length)
    .map((c) => c.e)
  if (near.length === 0) return shooters.map(() => null)
  const taken = new Set<T>()
  return shooters.map((s) => {
    const free = near.filter((e) => !taken.has(e))
    const pool = free.length ? free : near
    let best = pool[0]
    for (const e of pool) if (dist(s, e) < dist(s, best)) best = e
    taken.add(best)
    return best
  })
}
