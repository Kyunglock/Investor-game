import type { Sex } from '../types'
import type { AgeStage, Pose, View } from './bodies'

/** 그림 속 사람 하나. 회사 건물 그림의 직원·손님이 쓴다 (decisions.md 213번). */
export interface Figure {
  who: 'me' | 'spouse' | 'kid'
  sex: Sex
  stage: AgeStage
  x: number
  /** 아이의 생김새: 태어난 순서(0부터). 아이마다 옷·머리 색과 배냇머리가 다르다 (looks.ts, decisions.md 178번) */
  look?: number
  /** 등에 업은 아기. side는 아기 머리가 보이는 어깨 쪽 (decisions.md 178번) */
  carrying?: Carried
  /** 자세. 없으면 서 있다 (decisions.md 192번) */
  pose?: Pose
  /** 가슴에 안은 아기 (자세 hold) */
  holding?: Omit<Carried, 'side'>
  /** 바닥에서 띄우는 칸 수. 무대 위에 선 아이처럼 (decisions.md 192번) */
  lift?: number
  /** 옷·머리 색 바꾸기. 회사 직원의 차림새처럼 (decisions.md 213번). 가족의 색 위에 덮는다 */
  recolor?: Record<string, string>
  /** 보는 방향. 없으면 정면 (decisions.md 196번) */
  view?: View
  /** 옆모습이 보는 쪽. 없으면 오른쪽 */
  facing?: 'left' | 'right'
}

export interface Carried {
  sex: Sex
  look: number
  side: 'left' | 'right'
}

/** 배우자는 옷·머리 색만 바꿔 플레이어와 구분한다. 명암 단계(윤곽·그림자·기본·밝은 쪽)까지 함께 바꾼다 (decisions.md 142번). 아이는 looks.ts의 KID_LOOKS. */
export const SPOUSE_RECOLOR: Record<string, string> = {
  // 분홍 옷, 조금 더 짙은 머리
  q: '#5a2a38',
  d: '#8e4a5c',
  c: '#b5657a',
  C: '#d0889b',
  j: '#2e1a12',
  h: '#4a2d22',
  H: '#6b4434',
  i: '#8a6048',
}
