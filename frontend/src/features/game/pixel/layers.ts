import type { Sex, Stats } from '../../../api/client'
import { nickname } from '../nickname'
import type { AdornmentKey } from './adornments'
import { type AgeStage, stageFor } from './bodies'
import type { MoodKey } from './moods'

/** 한 캐릭터를 그리는 데 필요한 겹: 나이 몸통, 성별(여자면 긴 머리·치마), 강점 머리장식, 약점 표시. */
export interface SpriteSpec {
  stage: AgeStage
  sex: Sex
  adornment: AdornmentKey | null
  mark: keyof Stats | null
  /** 순간의 표정. 없으면 평소 얼굴 (decisions.md 62번) */
  mood?: MoodKey | null
}

const SPECIAL: Record<string, AdornmentKey | null> = {
  '타고난 투자 천재': 'genius',
  '앞날이 험난한 사람': 'rough',
  '무난한 보통 사람': null,
}

/**
 * 장식은 태어날 때의 능력치(별명)로 정해 평생 안 바뀌고, 약점 표시는 현재 능력치로 정해 성장하면 바뀐다.
 * 특별 별명 셋은 약점 표시가 없다 (설계 7.1절).
 */
export function layersFor(
  initialStats: Stats,
  stats: Stats,
  ageYears: number,
  sex: Sex,
): SpriteSpec {
  const born = nickname(initialStats)
  const stage = stageFor(ageYears)
  if (born.name in SPECIAL) {
    return { stage, sex, adornment: SPECIAL[born.name], mark: null }
  }
  return { stage, sex, adornment: born.strength, mark: nickname(stats).weakness }
}
