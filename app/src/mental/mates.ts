/**
 * 함께 싸우는 고양이 (decisions.md 393번): "고양이 한 마리 더" 카드로 한 마리씩, 최대 셋(cards.ts MAX_MATES). 사장냥과 똑같이 세다: 같은 무기·피해·연사·
 * 카드 효과로 저마다 총을 쏜다. 마법은 쓰지 않는다(마법은 사장냥만, 440번). 생김새는 사장냥 그림에 색만 바꿔 굽는다
 * (art.ts bakeMates). 이 모듈은 Phaser 없이 늘어서는 자리와 색만 가진다.
 */

/** 고양이마다 색(사장냥 그림에 'color'로 섞는다)과 합류할 때 띄우는 이름. 들어온 차례대로. */
export const MATE_LOOKS: readonly { color: string; name: string }[] = [
  { color: '#5fb4ff', name: '하늘냥' },
  { color: '#3fcf9a', name: '민트냥' },
  { color: '#b98cff', name: '라일락냥' },
]

/** 고양이 사이의 가장 넓은 간격(px)과 화면 양쪽에 남길 틈(px). */
export const MATE_GAP = 84
export const MATE_MARGIN = 22

/**
 * 멘탈벽 뒤 한 줄로 늘어선 자리(가운데에서 x 차이, px). 0번이 사장냥, 1번부터 들어온 차례의 고양이다. 줄 전체가 가운데에 오고, 사장냥은 가운데(짝수면
 * 가운데 왼쪽)에 선다. 고양이는 오른쪽 옆, 왼쪽 옆, 그다음 오른쪽 끝 순으로 붙는다. 간격은 화면 폭에 맞춰 좁아진다(320px에 넷이면 69px).
 */
export function mateFormation(count: number, width: number): number[] {
  const n = Math.max(1, count)
  const gap = Math.min(MATE_GAP, Math.max(0, width - MATE_MARGIN * 2) / n)
  const slot = (k: number) => (k - (n - 1) / 2) * gap
  const hero = Math.floor((n - 1) / 2)
  // 사장냥 자리에서 오른쪽·왼쪽으로 번갈아 넓혀 간다.
  const order: number[] = []
  for (let d = 1; order.length < n - 1; d++) {
    if (hero + d < n) order.push(hero + d)
    if (hero - d >= 0 && order.length < n - 1) order.push(hero - d)
  }
  return [slot(hero), ...order.map(slot)]
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
