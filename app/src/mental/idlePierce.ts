/**
 * 매도벽 돌파의 총알 관통 (decisions.md 520번). 모든 총알은 맨 앞 벽을 맞힌 뒤 뒤의 두 벽까지 뚫고 가며, 벽을 하나 뚫을 때마다 피해가 절반이 된다.
 * 무기나 강화로 바뀌지 않는 고정값이다. 서버 `IdleEngine.PIERCE`와 같은 값이어야 한다: 서버는 뒤 벽의 명중 하나를 이 비율까지만 받는다.
 * 보조게임(멘탈 디펜스)의 소총 관통(376번, `weaponEffects.ts`)과는 다른 규칙이다.
 */
export const IDLE_PIERCE: readonly number[] = [1, 0.5, 0.25]

/** 뒤 벽이 남기는 체력: 맨 앞 벽보다 먼저 깨지지 않게 서버가 여기까지만 깎는다. */
export const IDLE_PIERCE_FLOOR = 1

export interface PierceHit {
  wall: number
  /** 맨 앞 벽에서 몇 번째 뒤인가 (1·2). */
  behind: number
  damage: number
}

/**
 * 맨 앞 벽(front)을 damage로 맞힌 총알이 뒤 벽들에 주는 피해. walls는 뒤에 보이는 벽들의 남은 체력이다. 보이지 않는 벽과 이미 바닥(1)까지 깎인 벽은
 * 맞지 않지만, 총알은 그 벽도 뚫고 간 셈이라 그 뒤 벽의 비율은 그대로다.
 */
export function idlePierceHits(
  front: number,
  damage: number,
  walls: readonly { wall: number; hp: number }[],
): PierceHit[] {
  if (!Number.isFinite(damage) || damage <= 0) return []
  const hits: PierceHit[] = []
  for (let behind = 1; behind < IDLE_PIERCE.length; behind++) {
    const target = walls.find((entry) => entry.wall === front + behind)
    if (!target || target.hp <= IDLE_PIERCE_FLOOR) continue
    hits.push({ wall: target.wall, behind, damage: damage * IDLE_PIERCE[behind] })
  }
  return hits
}
