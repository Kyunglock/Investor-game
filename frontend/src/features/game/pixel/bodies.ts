import type { Sex } from '../../../api/client'
import { BODY_MAPS, POSE_MAPS } from './bodyMaps'
import type { Body } from './sprite'

/**
 * 나이 몸통 다섯 × 성별 둘 (32×40, decisions.md 142번). 그림은 scripts/pixel/bodies.py가 만든 bodyMaps.ts에 있다.
 * 모든 몸통은 같은 머리를 쓰므로 얼굴 좌표가 같다. 머리 윗줄 headTop(ht) 기준으로
 * - 머리 윤곽은 ht-1 줄, 머리는 ht~ht+18 줄, 목은 ht+19 줄, 옷은 ht+20 줄부터
 * - 눈은 ht+12~ht+14 줄의 10~12열과 19~21열(3×3 눈동자, 반짝임은 ht+13 줄의 10·19열), 그 아래 ht+15 줄은 반사
 * - 볼은 ht+16 줄의 8·9·22·23열, 코는 ht+16 줄 16열, 입은 ht+17 줄 15·16열
 * - 얼굴 가장자리는 ht+12~ht+14 줄에서 6열과 25열. 몸은 4~27열(24칸) 안에 든다
 * 장식·약점 표시·표정은 이 좌표를 기준으로 그린다.
 */
export type AgeStage = 'baby' | 'child' | 'adult' | 'middle' | 'old'

export const AGE_STAGES: AgeStage[] = ['baby', 'child', 'adult', 'middle', 'old']

export function stageFor(ageYears: number): AgeStage {
  if (ageYears <= 4) {
    return 'baby'
  }
  if (ageYears <= 13) {
    return 'child'
  }
  if (ageYears <= 39) {
    return 'adult'
  }
  if (ageYears <= 64) {
    return 'middle'
  }
  return 'old'
}

/**
 * 자세 (decisions.md 192번). stand 늘어뜨린 팔(노년은 지팡이), cheer 두 팔 만세, wave 오른팔만 들기, clap 가슴 앞 손뼉,
 * hold 가슴 앞에 아기를 안는 팔(아기는 Person이 그린다), reach-left·reach-right 옆 사람에게 뻗은 팔(손을 잡거나 어깨를 감싼다).
 */
export type Pose = 'stand' | 'cheer' | 'wave' | 'clap' | 'hold' | 'reach-left' | 'reach-right'

/** 성별·나이의 몸통. 여자는 긴 머리와 치마(노년은 쪽 찐 머리), 중년 남자는 넥타이, 노년은 흰머리와 지팡이. 아기는 자세가 없다. */
export function bodyFor(sex: Sex, stage: AgeStage, pose: Pose = 'stand'): Body {
  if (pose === 'stand') {
    return BODY_MAPS[sex][stage]
  }
  return POSE_MAPS[pose][sex][stage] ?? BODY_MAPS[sex][stage]
}
