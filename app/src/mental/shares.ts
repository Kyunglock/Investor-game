/** 매도벽과 매수·공격 표시가 함께 쓰는 물량 환산. 전투 계산값은 바꾸지 않는다. */
export const SHARES_PER_HP = 150

export function sharesOf(hp: number): number {
  return hp > 0 ? Math.max(1, Math.round(hp * SHARES_PER_HP)) : 0
}

export function shareLabel(hp: number): string {
  return `${sharesOf(hp).toLocaleString('ko-KR')}주`
}
