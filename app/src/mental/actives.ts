import { IDLE_GAME_SPEED } from './assault'

/**
 * 액티브 스킬 (decisions.md 503번). 대기 시간과 받아 주는 피해는 서버(IdleEngine)가 정하고, 여기는 화면의 연출 수치다.
 * 시간은 전투 초(1.5배속이라 실제 시간의 1.5배)이고 서버의 ACTIVE_SECONDS와 같다.
 *
 * 앞의 여섯은 사장냥의 고유 스킬이다 (587·591번): 이제 누르지 않고, 매도벽을 부숴 레벨이 오를 때 고르는 레벨업 카드로 1분 동안 켠다 (667번).
 * 뒤의 셋은 광고 스킬이다 (588번): 광고를 보면 쓴다.
 */
/** 레벨업 카드로 켠 고유 스킬이 이어지는 전투 초 (667번): 실제 1분. 서버 IdleEngine.CARD_SECONDS와 같다. */
export const CARD_SECONDS = 60 * IDLE_GAME_SPEED

/** 광고 스킬의 배수 (588번, 서버 IdleEngine.BOOST). */
export const BOOST = 3

export const ACTIVES = {
  /** 매수세례: 매수벽이 seconds마다 매수 주문 shots장의 빠르기로 쏟아 낸다(카드는 CARD_SECONDS 동안). 한 장은 보통 매수 주문의 power배다. */
  barrage: { seconds: 6, shots: 40, power: 1 },
  /** 불장: 이 시간 동안 사장냥과 고양이의 총이 fire배 빨리 나간다. */
  rally: { seconds: 10, fire: 2 },
  /** 방어선 구축: 매수벽이 바로 다시 서고 이 시간 동안 깎이지 않는다. */
  fortify: { seconds: 6 },
  /** 상한가 (591번): 이 시간 동안 사장냥과 고양이의 모든 총알이 치명타다. */
  limitUp: { seconds: 12 },
  /**
   * 손절 (591번): 매수벽의 지금 체력에서 ratio만큼을 버리고 매도벽을 한 번 크게 친다. 가득 찬 매수벽에서 쓰면 매수 주문 orders장어치이고,
   * 버린 만큼 줄어든다. 서버 IdleEngine.STOP_LOSS_ORDERS와 같다.
   */
  stopLoss: { ratio: 0.5, orders: 240 },
  /**
   * 물타기 (591번): 이 시간 동안 매수 주문(매수세례 포함)이 세진다. 매수벽이 가득 차 있으면 min배, 깎인 만큼 커져 다 깎이면 max배다. 서버
   * IdleEngine.AVERAGING_MAX와 같다.
   */
  averaging: { seconds: 15, min: 1.5, max: 3 },
  /** 공격속도 3배: 이 시간 동안 모든 총이 BOOST배 빨리 나간다. 불장과 겹치면 더 큰 쪽(3배)만 센다. */
  boostFire: { seconds: 270 },
  /** 공격력 3배: 이 시간 동안 총알과 고양이 스킬의 피해가 BOOST배다. */
  boostDamage: { seconds: 270 },
  /** 매수공격 3배: 이 시간 동안 매수 주문(매수세례 포함)의 피해가 BOOST배다. */
  boostBuy: { seconds: 270 },
} as const

export type ActiveCode = keyof typeof ACTIVES
/** 광고 스킬 (588번): 정해진 시간 동안 배수가 붙는다. */
export type BoostCode = 'boostFire' | 'boostDamage' | 'boostBuy'

export const isBoost = (code: ActiveCode): code is BoostCode => code.startsWith('boost')

/** 물타기의 배수 (591번): 매수벽의 남은 체력이 적을수록 크다. */
export function averagingMult(hp: number, maxHp: number): number {
  const { min, max } = ACTIVES.averaging
  const lost = maxHp > 0 ? Math.min(1, Math.max(0, 1 - hp / maxHp)) : 0
  return min + (max - min) * lost
}

/** 손절의 한 방 (591번): 매수 주문 한 장의 피해(order)와 버린 매수벽 체력(lost)으로 센다. 가득 찬 벽의 ratio만큼을 버렸을 때가 가장 세다. */
export function stopLossDamage(order: number, lost: number, maxHp: number): number {
  const { ratio, orders } = ACTIVES.stopLoss
  const share = maxHp > 0 ? Math.min(1, Math.max(0, lost / (maxHp * ratio))) : 0
  return order * orders * share
}

/** 쓸 때 뜨는 알림: 글과 띠 색. */
export const ACTIVE_BANNERS: Record<ActiveCode, [string, string]> = {
  barrage: ['매수세례!!', '#e8434f'],
  rally: ['불장이다!! 연사 두 배', '#f08a24'],
  fortify: ['방어선 구축! 매수벽 무적', '#2f9e74'],
  limitUp: ['상한가!! 전부 치명타', '#e8434f'],
  stopLoss: ['손절!! 매수벽을 던진다', '#2f7fe0'],
  averaging: ['물타기! 매수 주문 강화', '#2f9e74'],
  boostFire: ['공격속도 3배!!', '#f08a24'],
  boostDamage: ['공격력 3배!!', '#e8434f'],
  boostBuy: ['매수공격 3배!!', '#2f7fe0'],
}

/** 단추에 적는 한 줄 설명. */
export const ACTIVE_HINTS: Record<ActiveCode, string> = {
  barrage: '매수 주문을 쏟아 내요',
  rally: '연사 두 배',
  fortify: '매수벽 회복·무적',
  limitUp: '전부 치명타',
  stopLoss: '매수벽 절반으로 한 방',
  averaging: '깎인 만큼 매수 강화',
  boostFire: '연사 세 배',
  boostDamage: '피해 세 배',
  boostBuy: '매수 주문 세 배',
}

/** 레벨업 카드와 스킬 탭에 적는 설명 (587·667번). */
export const ACTIVE_NOTES: Record<ActiveCode, string> = {
  barrage: '매수벽이 1분 동안 매수 주문을 쏟아 내요.',
  rally: '1분 동안 사장냥과 고양이의 총이 두 배 빨리 나가요.',
  fortify: '매수벽이 바로 다시 서고, 1분 동안 깎이지 않아요.',
  limitUp: '1분 동안 사장냥과 고양이의 총알이 모두 치명타가 돼요.',
  stopLoss:
    '매수벽의 남은 체력 절반을 버리고 매도벽을 크게 한 번 쳐요. 가득 찬 매수벽에서 쓰면 매수 주문 240장어치예요.',
  averaging:
    '1분 동안 매수 주문이 1.5배 세져요. 매수벽이 깎여 있을수록 더 세져 3배까지 올라요. 매수세례에도 적용돼요.',
  boostFire: '사장냥과 고양이의 총이 세 배 빨리 나가요. 불장과 겹치면 세 배만 적용돼요.',
  boostDamage: '총알과 고양이 스킬의 피해가 세 배가 돼요.',
  boostBuy: '매수 주문의 피해가 세 배가 돼요. 매수세례에도 적용돼요.',
}
