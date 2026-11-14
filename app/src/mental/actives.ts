/**
 * 액티브 스킬 (decisions.md 503번): 자동 전투에서 눌러서 쓴다. 대기 시간과 받아 주는 피해는 서버(IdleEngine)가 정하고, 여기는 화면의 연출 수치다.
 * 시간은 전투 초(2배속이라 실제 시간의 두 배)이고 서버의 ACTIVE_SECONDS와 같다.
 */
export const ACTIVES = {
  /** 매수세례: 매수벽이 이 시간 동안 매수 주문 shots장을 쏟아 낸다. 한 장은 보통 매수 주문의 power배다. */
  barrage: { seconds: 6, shots: 40, power: 3 },
  /** 불장: 이 시간 동안 사장냥과 고양이의 총이 fire배 빨리 나간다. */
  rally: { seconds: 10, fire: 2 },
  /** 방어선 구축: 매수벽이 바로 다시 서고 이 시간 동안 깎이지 않는다. */
  fortify: { seconds: 6 },
} as const

export type ActiveCode = keyof typeof ACTIVES

/** 쓸 때 뜨는 알림: 글과 띠 색. */
export const ACTIVE_BANNERS: Record<ActiveCode, [string, string]> = {
  barrage: ['매수세례!!', '#e8434f'],
  rally: ['불장이다!! 연사 두 배', '#f08a24'],
  fortify: ['방어선 구축! 매수벽 무적', '#2f9e74'],
}

/** 단추에 적는 한 줄 설명. */
export const ACTIVE_HINTS: Record<ActiveCode, string> = {
  barrage: '매수 주문을 쏟아 내요',
  rally: '연사 두 배',
  fortify: '매수벽 회복·무적',
}
