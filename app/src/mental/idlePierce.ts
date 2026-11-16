/**
 * 매도벽 돌파의 총알 관통 (decisions.md 520번). 모든 총알은 맨 앞 벽을 맞힌 뒤 뒤의 두 벽까지 뚫고 가며, 벽을 하나 뚫을 때마다 피해가 절반이 된다.
 * 무기나 강화로 바뀌지 않는 고정값이다. 서버 `IdleEngine.PIERCE`와 같은 값이어야 한다: 서버는 뒤 벽의 명중 하나를 이 비율까지만 받는다.
 * 보조게임(멘탈 디펜스)의 소총 관통(376번, `weaponEffects.ts`)과는 다른 규칙이다.
 */
export const IDLE_PIERCE: readonly number[] = [1, 0.5, 0.25]

/** 보스(대량 매도벽)가 서는 간격: 50번째 벽마다 (547·550번, 서버 IdleEngine.BOSS_EVERY). */
export const IDLE_BOSS_EVERY = 50

/** 보스 벽: 대량 매도벽(큰손 벽, 서버 IdleEngine.maxHp의 BOSS_HP). 열 번째 벽마다 서던 것은 없앴다 (550번). */
export function idleBossWall(wall: number): boolean {
  return Math.floor(wall) % IDLE_BOSS_EVERY === 0
}

/**
 * 총알이 맨 앞 벽(front) 뒤로 몇 벽까지 뚫고 가나: 대량 매도벽은 뚫리지 않는다. 맨 앞이 대량 매도벽이면 0이고, 뒤에 대량 매도벽이 있으면 그 앞까지다
 * (대량 매도벽 자신도 관통 피해를 받지 않는다). 서버 IdleEngine.pierceBlocked와 같은 규칙이다.
 */
export function idlePierceReach(front: number): number {
  if (idleBossWall(front)) return 0
  for (let behind = 1; behind < IDLE_PIERCE.length; behind++) {
    if (idleBossWall(front + behind)) return behind - 1
  }
  return IDLE_PIERCE.length - 1
}

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
  for (let behind = 1; behind <= idlePierceReach(front); behind++) {
    const target = walls.find((entry) => entry.wall === front + behind)
    if (!target || target.hp <= IDLE_PIERCE_FLOOR) continue
    hits.push({ wall: target.wall, behind, damage: damage * IDLE_PIERCE[behind] })
  }
  return hits
}
