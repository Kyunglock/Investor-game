/**
 * 액티브 스킬 (decisions.md 503번): 자동 전투에서 눌러서 쓴다. 대기 시간과 받아 주는 피해는 서버(IdleEngine)가 정하고, 여기는 화면의 연출 수치다.
 * 시간은 전투 초(1.5배속이라 실제 시간의 1.5배)이고 서버의 ACTIVE_SECONDS와 같다.
 *
 * 앞의 셋은 사장냥의 고유 스킬이다 (587번): 스킬 탭에서 장착한 것만 전투 화면에 단추가 선다. 뒤의 셋은 광고 스킬이다 (588번): 광고를 보면 쓴다.
 */
/** 광고 스킬의 배수 (588번, 서버 IdleEngine.BOOST). */
export const BOOST = 3

export const ACTIVES = {
  /** 매수세례: 매수벽이 이 시간 동안 매수 주문 shots장을 쏟아 낸다. 한 장은 보통 매수 주문의 power배다. */
  barrage: { seconds: 6, shots: 40, power: 3 },
  /** 불장: 이 시간 동안 사장냥과 고양이의 총이 fire배 빨리 나간다. */
  rally: { seconds: 10, fire: 2 },
  /** 방어선 구축: 매수벽이 바로 다시 서고 이 시간 동안 깎이지 않는다. */
  fortify: { seconds: 6 },
  /** 공격속도 3배: 이 시간 동안 모든 총이 BOOST배 빨리 나간다. 불장과 겹치면 더 큰 쪽(3배)만 센다. */
  boostFire: { seconds: 90 },
  /** 공격력 3배: 이 시간 동안 총알과 고양이 스킬의 피해가 BOOST배다. */
  boostDamage: { seconds: 90 },
  /** 매수공격 3배: 이 시간 동안 매수 주문(매수세례 포함)의 피해가 BOOST배다. */
  boostBuy: { seconds: 90 },
} as const

export type ActiveCode = keyof typeof ACTIVES
/** 광고 스킬 (588번): 정해진 시간 동안 배수가 붙는다. */
export type BoostCode = 'boostFire' | 'boostDamage' | 'boostBuy'

export const isBoost = (code: ActiveCode): code is BoostCode => code.startsWith('boost')

/** 쓸 때 뜨는 알림: 글과 띠 색. */
export const ACTIVE_BANNERS: Record<ActiveCode, [string, string]> = {
  barrage: ['매수세례!!', '#e8434f'],
  rally: ['불장이다!! 연사 두 배', '#f08a24'],
  fortify: ['방어선 구축! 매수벽 무적', '#2f9e74'],
  boostFire: ['공격속도 3배!!', '#f08a24'],
  boostDamage: ['공격력 3배!!', '#e8434f'],
  boostBuy: ['매수공격 3배!!', '#2f7fe0'],
}

/** 단추에 적는 한 줄 설명. */
export const ACTIVE_HINTS: Record<ActiveCode, string> = {
  barrage: '매수 주문을 쏟아 내요',
  rally: '연사 두 배',
  fortify: '매수벽 회복·무적',
  boostFire: '연사 세 배',
  boostDamage: '피해 세 배',
  boostBuy: '매수 주문 세 배',
}

/** 스킬 탭에 적는 설명 (587번). */
export const ACTIVE_NOTES: Record<ActiveCode, string> = {
  barrage: '매수벽이 매수 주문 40장을 한꺼번에 쏟아 내요. 한 장이 보통 매수 주문의 3배예요.',
  rally: '사장냥과 고양이의 총이 두 배 빨리 나가요.',
  fortify: '매수벽이 바로 다시 서고, 그동안 깎이지 않아요.',
  boostFire: '사장냥과 고양이의 총이 세 배 빨리 나가요. 불장과 겹치면 세 배만 적용돼요.',
  boostDamage: '총알과 고양이 스킬의 피해가 세 배가 돼요.',
  boostBuy: '매수 주문의 피해가 세 배가 돼요. 매수세례에도 적용돼요.',
}
