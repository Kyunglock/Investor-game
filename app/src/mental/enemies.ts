/** 적 넷 (decisions.md 328·333번): 이름이 곧 행동이다. 일자로 천천히 내려온다. 그림은 art.ts. */
export type EnemyKind = 'panic' | 'dump' | 'spec' | 'stop'

export interface EnemySpec {
  /** 충돌 판정 반지름(px). 그림(64×64)의 몸통 크기에 맞춘다. */
  r: number
  /** 파편과 설명 점의 색. */
  fill: string
  label: string
  hp: number
  speed: number
  /** 플레이어(또는 금고)에 닿았을 때 깎는 멘탈. */
  dmg: number
  /** 물리쳤을 때 오르는 수익(만 원). 화면용 점수다. */
  reward: number
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  /** 패닉셀: 빠르고 떼로 */
  panic: { r: 16, fill: '#5b93e6', label: '패닉', hp: 1, speed: 95, dmg: 5, reward: 10 },
  /** 투매: 한쪽에서 줄지어 쏟아진다. 느리지만 단단하다 */
  dump: { r: 19, fill: '#9a84d9', label: '투매', hp: 4, speed: 50, dmg: 8, reward: 25 },
  /** 투기: 크고 느리다. 부풀다가 터지면 근처 멘탈을 크게 깎는다 */
  spec: { r: 23, fill: '#ea4d6a', label: '투기', hp: 16, speed: 30, dmg: 14, reward: 80 },
  /** 손절매: 단단하고 곧장 내려와 부딪힌다(원거리 공격은 없다, 340번) */
  stop: { r: 16, fill: '#9ba2ad', label: '손절', hp: 5, speed: 65, dmg: 6, reward: 40 },
}
