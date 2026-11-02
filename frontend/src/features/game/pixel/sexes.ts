import type { Sex } from '../../../api/client'

/**
 * 성별 (decisions.md 69번). 서버가 준 값 그대로 쓴다: 나는 판 시드로, 아이는 태어날 때 정해지고, 배우자는 나와 반대다.
 * 여자 몸은 따로 그린 몸통이다(bodies.ts의 bodyFor, decisions.md 142번).
 */
export const opposite = (sex: Sex): Sex => (sex === 'M' ? 'F' : 'M')
