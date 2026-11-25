/**
 * 방치형 전투를 잠시 세운다 (decisions.md 682번): 스테이지 한 판을 하거나 광고를 보는 동안에는 메인 화면의 자동 전투가 돌지 않는다. 화면의
 * 전투(app IdleCanvas)는 멈추고, 서버로 가는 박동(useIdleBattle)도 앱이 뒤로 간 때처럼 끊는다. 까닭(reason)마다 따로 세어, 하나라도 걸려
 * 있으면 서 있다.
 */
const holds = new Set<string>()

/** 걸리거나 풀릴 때 알리는 신호: detail은 지금 서 있는가. */
export const IDLE_HOLD_EVENT = 'idle-hold'

export function idleHeld(): boolean {
  return holds.size > 0
}

export function holdIdle(reason: string, on: boolean) {
  const before = idleHeld()
  if (on) holds.add(reason)
  else holds.delete(reason)
  if (before !== idleHeld() && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(IDLE_HOLD_EVENT, { detail: idleHeld() }))
  }
}
