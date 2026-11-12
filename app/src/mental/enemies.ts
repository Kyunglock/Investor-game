import { SHARES_PER_HP } from './shares'

/** 패닉셀·투매·투기·손절·공매도: 이름이 곧 행동이다. 일자로 천천히 내려온다. 그림은 art.ts. */
export type EnemyKind = 'panic' | 'dump' | 'spec' | 'stop' | 'short'

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
  short: { r: 19, fill: '#44558c', label: '공매도', hp: 9, speed: 43, dmg: 11, reward: 45 },
  /** 패닉셀: 빠르고 떼로 */
  panic: { r: 16, fill: '#5b93e6', label: '패닉', hp: 1, speed: 95, dmg: 5, reward: 10 },
  /** 투매: 한쪽에서 줄지어 쏟아진다. 느리지만 단단하다 */
  dump: { r: 19, fill: '#9a84d9', label: '투매', hp: 4, speed: 50, dmg: 8, reward: 25 },
  /** 투기: 크고 느리다. 부풀다가 터지면 근처 멘탈을 크게 깎는다 */
  spec: { r: 23, fill: '#ea4d6a', label: '투기', hp: 16, speed: 30, dmg: 14, reward: 80 },
  /** 손절매: 단단하고 곧장 내려와 부딪힌다(원거리 공격은 없다, 340번) */
  stop: { r: 16, fill: '#9ba2ad', label: '손절', hp: 5, speed: 65, dmg: 6, reward: 40 },
}

/**
 * 공격 판의 매도 물량 (decisions.md 413번, #573): 공격 판에는 패닉셀·투매 고양이와 파란 "매도" 주문서가 함께 나온다. 그림은 art.ts bakeOrders. 64×64 그림
 * 좌표의 반지름(r)에 scale을 곱해 보인다(주문서 숫자가 읽히게 고양이 적보다 크게).
 */
export type OrderKind = 'order' | 'market' | 'bulk' | 'fake' | 'cell' | 'whale'
export type UnitKind = EnemyKind | OrderKind

export interface OrderSpec extends EnemySpec {
  /** 64×64 그림을 보이는 배율(고양이 적의 ENEMY_SCALE에 곱한다). */
  scale: number
  /** 주문서에 적힌 물량(주). 잡으면 이 숫자가 깎이며 "체결!" */
  shares: number
}

/** 매도 물량의 빠르기는 474번 뒤 사용자 요청으로 1.5배(매도 87·시장가 192·대량 45·허매도 99). */
export const ORDERS: Record<OrderKind, OrderSpec> = {
  /** 매도 주문(100주): 천천히 사장냥 쪽으로 다가온다 */
  order: {
    r: 17,
    fill: '#3a7bea',
    label: '매도',
    hp: 2.4,
    speed: 87,
    dmg: 6,
    reward: 12,
    scale: 1.45,
    shares: 100,
  },
  /** 시장가 매도(1,000주): 작고 빠르게 떼로 쏟아진다 */
  market: {
    r: 12,
    fill: '#5aa2ff',
    label: '시장가',
    hp: 0.9,
    speed: 192,
    dmg: 4,
    reward: 6,
    scale: 1.3,
    shares: 1000,
  },
  /** 대량 매도(5,000주): 묵직하고 느리고 단단하다 */
  bulk: {
    r: 24,
    fill: '#2347a8',
    label: '대량 매도',
    hp: 13,
    speed: 45,
    dmg: 13,
    reward: 55,
    scale: 1.55,
    shares: 5000,
  },
  /** 허매도: 맞히면 그냥 사라지는 가짜 물량(체결이 아니라 경험치·처치가 없다) */
  fake: {
    r: 17,
    fill: '#9db6dc',
    label: '허매도',
    hp: 1,
    speed: 99,
    dmg: 4,
    reward: 0,
    scale: 1.45,
    shares: 3000,
  },
  /** 매도벽의 한 칸(층): 움직이지 않고 벽과 함께 내려온다. 체력·물량은 판(assault.ts)이 정한다. 경험치는 층 하나에 30(#700, 전에는 5) */
  cell: {
    r: 15,
    fill: '#4f8df0',
    label: '매도벽',
    hp: 8,
    speed: 0,
    dmg: 0,
    reward: 30,
    scale: 1,
    shares: 1000,
  },
  /** 마지막 대량 매도벽 앞의 큰손 보스: 체력은 판이 정한다 */
  whale: {
    r: 26,
    fill: '#1f3f99',
    label: '큰손',
    hp: 70,
    speed: 0,
    dmg: 15,
    reward: 200,
    scale: 2.3,
    shares: 50000,
  },
}

/** 몬스터와 매도 물량을 한 표로: 전투(battle.ts)는 이 표로 반지름·체력·피해를 읽는다. 디펜스 출전 화면의 적 소개는 ENEMIES(몬스터 다섯)만 쓴다. */
export const UNITS: Record<UnitKind, EnemySpec & { scale?: number; shares?: number }> = {
  ...ENEMIES,
  ...ORDERS,
}

export function isOrder(kind: UnitKind): kind is OrderKind {
  return kind in ORDERS
}

/** 티켓과 체결 표시는 같은 스테이지 체력 배율로 물량을 늘린다. */
export function orderShares(kind: OrderKind, hpScale = 1): number {
  return Math.max(1, Math.round(ORDERS[kind].shares * hpScale))
}

/**
 * 수량이 곧 체력이자 공격인 매도 물량 (474번 뒤 사용자 요청): 매도 주문·시장가·대량 매도. 허매도(가짜 물량)·매도벽 칸·큰손은 따로 센다.
 */
export function quantityOrder(kind: UnitKind): boolean {
  return kind === 'order' || kind === 'market' || kind === 'bulk'
}

/** 매도 물량의 체력(전투 단위): 화면의 수량(orderShares) ÷ SHARES_PER_HP. 100주면 100주만큼 맞아야 체결된다. */
export function orderHp(kind: OrderKind, hpScale = 1): number {
  return orderShares(kind, hpScale) / SHARES_PER_HP
}

/**
 * 매수 주문과 매도 물량이 부딪힐 때 (전투 단위): 서로 적은 쪽만큼 상쇄한다. used만큼 매도가 줄고, 매수는 left가 남아 계속 날아간다(0이면 사라진다).
 */
export function crossOrders(buy: number, sell: number): { used: number; left: number } {
  const used = Math.max(0, Math.min(buy, sell))
  return { used, left: Math.max(0, buy - used) }
}
