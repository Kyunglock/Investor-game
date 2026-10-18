import type { Stats } from '../../../api/client'
import { nickname } from '../nickname'
import type { AdornmentKey } from './adornments'
import { type AgeStage, stageFor } from './bodies'

/** 한 캐릭터를 그리는 데 필요한 세 겹: 나이 몸통, 강점 머리장식, 약점 표시. */
export interface SpriteSpec {
  stage: AgeStage
  adornment: AdornmentKey | null
  mark: keyof Stats | null
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
export function layersFor(initialStats: Stats, stats: Stats, ageYears: number): SpriteSpec {
  const born = nickname(initialStats)
  const stage = stageFor(ageYears)
  if (born.name in SPECIAL) {
    return { stage, adornment: SPECIAL[born.name], mark: null }
  }
  return { stage, adornment: born.strength, mark: nickname(stats).weakness }
}
