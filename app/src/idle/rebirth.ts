import type { Company } from '@web/api/client'

/** 환생 (decisions.md 571번): 서버가 주는 환생 횟수·가진 생선·지금 환생하면 받을 생선. */
export type Rebirth = NonNullable<NonNullable<Company['idle']>['rebirth']>

/** 환생하지 못하는 까닭. 할 수 있으면 null이다. 첫 보스를 깬 다음 벽(fromWall)부터 할 수 있다. */
export function rebirthBlock(rebirth: Rebirth): string | null {
  return rebirth.gain > 0
    ? null
    : `매도벽 ${rebirth.fromWall.toLocaleString()}부터 환생할 수 있어요`
}
