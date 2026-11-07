/** 적 넷 (decisions.md 328번): 이름이 곧 행동이다. */
export type EnemyKind = 'panic' | 'dump' | 'spec' | 'stop'

export interface EnemySpec {
  /** 반지름(px). 그림과 충돌 판정에 같이 쓴다. */
  r: number
  fill: string
  label: string
  font: number
  hp: number
  speed: number
  /** 플레이어(또는 금고)에 닿았을 때 깎는 멘탈. */
  dmg: number
  /** 물리쳤을 때 오르는 수익(만 원). 화면용 점수다. */
  reward: number
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  /** 패닉셀: 빠르고 떼로, 우왕좌왕 */
  panic: { r: 15, fill: '#6aa8ff', label: '패닉', font: 11, hp: 1, speed: 170, dmg: 5, reward: 10 },
  /** 투매: 한쪽에서 줄지어 쏟아진다. 느리지만 단단하다 */
  dump: { r: 20, fill: '#a98bff', label: '투매', font: 13, hp: 4, speed: 80, dmg: 8, reward: 25 },
  /** 투기: 크고 느리다. 부풀다가 터지면 근처 멘탈을 크게 깎는다 */
  spec: { r: 30, fill: '#ff4f6d', label: '투기', font: 16, hp: 16, speed: 45, dmg: 14, reward: 80 },
  /** 손절매: 거리를 두고 멘탈 탄을 쏜다 */
  stop: { r: 19, fill: '#cfd3dd', label: '손절', font: 13, hp: 5, speed: 110, dmg: 6, reward: 40 },
}

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[]
