import type { Stats } from '../../api/client'
import { STAT_KEYS } from './labels'

/**
 * 태어날 때의 능력치로 별명을 짓는다. 가장 높은 능력치가 정체성, 가장 낮은 능력치가 약점이다.
 * 화면 표시용이며 게임 규칙에는 쓰지 않는다.
 */

type StatKey = keyof Stats

const STRENGTH_TITLES: Record<StatKey, string> = {
  insight: '족집게',
  patience: '돌부처',
  courage: '불도저',
  conviction: '소신파',
  luck: '행운아',
}

const WEAKNESS_PREFIXES: Record<StatKey, string> = {
  insight: '눈치 없는',
  patience: '성질 급한',
  courage: '겁 많은',
  conviction: '귀가 얇은',
  luck: '운 없는',
}

/** 약점이 게임에서 어떻게 드러나는지. 억울함의 원인을 미리 알려 둔다. */
const WEAKNESS_EFFECTS: Record<StatKey, string> = {
  insight: '힌트가 흐릿하거나 틀릴 수 있다',
  patience: '들고 있는 주식을 지켜보려다 못 참고 팔아 버릴 수 있다',
  courage: '매수·매도를 눌러도 겁나서 관망할 수 있다',
  conviction: '유튜버나 지인의 꼬드김에 넘어가 엉뚱한 선택을 할 수 있다',
  luck: '손실이 났을 때 운이 따라 주지 않는다',
}

// 시작 능력치는 등급(SSS~F)의 띠 안에서 뽑힌다 (grade.ts, decisions.md 24번). 모두 A 이상이면 천재, 모두 E 이하면 험난.
const GIFTED_FROM = 60
const STRUGGLING_BELOW = 30
const FLAT_SPREAD = 10

export interface Nickname {
  name: string
  strength: StatKey
  weakness: StatKey
  weaknessEffect: string
}

export function nickname(stats: Stats): Nickname {
  // 동점이면 STAT_KEYS 순서(안목 → 인내심 → 용기 → 줏대 → 운)에서 앞의 것을 고른다.
  const strength = STAT_KEYS.reduce((best, key) => (stats[key] > stats[best] ? key : best))
  const weakness = STAT_KEYS.reduce((worst, key) => (stats[key] < stats[worst] ? key : worst))
  const values = STAT_KEYS.map((key) => stats[key])
  const min = Math.min(...values)
  const max = Math.max(...values)

  const name =
    min >= GIFTED_FROM
      ? '타고난 투자 천재'
      : max < STRUGGLING_BELOW
        ? '앞날이 험난한 사람'
        : max - min < FLAT_SPREAD
          ? '무난한 보통 사람'
          : `${WEAKNESS_PREFIXES[weakness]} ${STRENGTH_TITLES[strength]}`

  return { name, strength, weakness, weaknessEffect: WEAKNESS_EFFECTS[weakness] }
}
