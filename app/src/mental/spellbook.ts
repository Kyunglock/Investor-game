/**
 * 고양이 스킬로만 나가는 마법들 (decisions.md 563번): 불·독·빛·어둠·모래·별·우박·꽃비·폭탄. 물·메테오·번개·충차(392·433번)와
 * 얼음·바람(561번)은 제 코드가 따로 있고, 여기 마법은 표 하나로 정한다: 전투의 수치와 그림, 배지의 색과 그림, 설명이 모두 이 표를 읽는다.
 *
 * 두 갈래다. flow는 물처럼 날아가는 것(창·물결·구슬), fall은 메테오처럼 경고 원 뒤에 떨어져 둘레를 때리는 것이다.
 * 주기와 피해는 Lv.1 값에서 Lv.5 값까지 고르게 변한다(ramp). 서버 IdleEngine의 EXTRA 표와 같아야 한다.
 */

/** 얼음 결정과 바람 소용돌이 (561번): 스킬 배지(idle/SkillBadge.tsx)의 첫 단계 그림과 같다. */
export const ICE_GLYPH = 'M24 12.5 28.5 20l7 4-7 4L24 35.5 19.5 28l-7-4 7-4Z'
export const WIND_GLYPH =
  'M13 20.5h14.5a4 4 0 1 0-4-4h2.6a1.4 1.4 0 1 1 1.4 1.4H13ZM13 25.5h20a4.5 4.5 0 1 1-4.5 4.5h2.6a1.9 1.9 0 1 0 1.9-1.9H13Z'

export type FlowSpell = 'fire' | 'poison' | 'light' | 'dark' | 'sand' | 'star'
export type FallSpell = 'hail' | 'blossom' | 'bomb'
export type ExtraSpell = FlowSpell | FallSpell | 'auroraNight'

export const FLOW_SPELLS: readonly FlowSpell[] = ['fire', 'poison', 'light', 'dark', 'sand', 'star']
export const FALL_SPELLS: readonly FallSpell[] = ['hail', 'blossom', 'bomb']
export const EXTRA_SPELLS: readonly ExtraSpell[] = [...FLOW_SPELLS, ...FALL_SPELLS, 'auroraNight']

/** Lv.1 값과 Lv.5 값. 사이 레벨은 고르게 나눈다. */
type Ramp = readonly [number, number]

/** level(1~5)의 값. 서버 IdleEngine.ramp와 같은 식이다. */
export function ramp([from, to]: Ramp, level: number): number {
  const at = Math.max(1, Math.min(5, level)) - 1
  return from + ((to - from) * at) / 4
}

interface Look {
  /** 스킬 이름(서버가 주는 이름과 같다)과 설명. */
  name: string
  does: string
  grows: string
  tiers: [string, string, string]
  /** 배지·머리 위 표식·전투 그림의 색: 밝은 색, 바탕 둘, 외곽선. */
  colors: { light: string; mid: string; dark: string; line: string }
  /** 배지 그림 (48×48 칸의 SVG path). */
  glyph: string
  /** 피해 숫자의 색. */
  number: string
  cooldown: Ramp
  /** 공격력에 곱하는 피해 배율. */
  damage: Ramp
}

export interface FlowSpec extends Look {
  kind: 'flow'
  /** 창(곧고 좁다)·물결(넓게 쓸고 간다)·구슬(처음 맞은 적에서 터진다). */
  form: 'jet' | 'wave' | 'drop'
  /** 맞는 폭의 절반(px)과 빠르기(px/초). */
  half: Ramp
  speed: number
  /** 구슬이 터지는 반지름(px). 창·물결은 0. */
  splash: Ramp
  /** 맞은 적의 빠르기 배율과 그 시간(초). 1·0이면 느려지지 않는다. */
  slowFactor: number
  slowSeconds: number
  /** 맞은 적이 멈추는 시간(초)과 밀려나는 시간(초). */
  stun: Ramp
  push: Ramp
}

export interface FallSpec extends Look {
  kind: 'fall'
  /** 터지는 반지름(px)과 레벨마다 떨어지는 수. */
  radius: Ramp
  count: readonly [number, number, number, number, number]
  /** 맞은 적이 멈추는 시간(초), 느려지는 배율과 시간(초). */
  stun: Ramp
  slowFactor: number
  slowSeconds: number
}

const none: Ramp = [0, 0]

export const SPELLBOOK: { [K in FlowSpell]: FlowSpec } & { [K in FallSpell]: FallSpec } & {
  auroraNight: Look & { kind: 'global' }
} = {
  auroraNight: {
    kind: 'global',
    name: '극광의 밤',
    does: '극광냥의 망토에서 펼쳐진 오로라가 적이나 매도벽에 닿으면 느려지고, 겹쳐 있는 동안 0.125초마다 피해를 줘요',
    grows: '레벨이 오르면 더 자주 발동하고 한 번에 주는 피해가 커져요',
    tiers: ['별빛', '극광', '극광의 밤'],
    colors: { light: '#fff3bc', mid: '#77eacb', dark: '#8575cc', line: '#363165' },
    glyph: 'M24 9 Q26 21 37 24 Q26 26 24 38 Q22 27 11 24 Q22 21 24 9Z',
    number: '#ffda83',
    cooldown: [6, 4],
    damage: [12, 28],
  },
  fire: {
    kind: 'flow',
    name: '불 스킬',
    does: '불덩이가 날아가 처음 맞은 적에서 터져 둘레를 함께 태워요',
    grows: '레벨이 오르면 더 크게 터지고 더 세져요',
    tiers: ['불씨', '불덩이', '큰 불덩이'],
    colors: { light: '#fff3c4', mid: '#ff9d3c', dark: '#e2452a', line: '#7a1f10' },
    glyph:
      'M24 11c2.6 5 8 8 8 15.2a8 8 0 0 1-16 0c0-4 2-6.4 3.8-9.2.9 2 1.9 3 3 3.2-.2-3.2.1-6.2 1.2-9.2Z',
    number: '#ffb066',
    cooldown: [3, 2.2],
    damage: [2.4, 5.6],
    form: 'drop',
    half: [12, 16],
    speed: 620,
    splash: [48, 84],
    slowFactor: 1,
    slowSeconds: 0,
    stun: none,
    push: none,
  },
  poison: {
    kind: 'flow',
    name: '독 스킬',
    does: '독침이 지나가는 적을 꿰뚫고 오래 느리게 해요',
    grows: '레벨이 오르면 더 자주 쏘고 더 느리게 해요',
    tiers: ['독침', '굵은 독침', '맹독침'],
    colors: { light: '#f3e6ff', mid: '#b47cf0', dark: '#6f3fc2', line: '#3a1d78' },
    glyph:
      'M24 14.5c4 5 6.2 8 6.2 11a6.2 6.2 0 0 1-12.4 0c0-3 2.2-6 6.2-11ZM14.5 15.5a2.2 2.2 0 1 0 .1 0ZM34 19.5a1.7 1.7 0 1 0 .1 0Z',
    number: '#c9a2ff',
    cooldown: [2.2, 1.4],
    damage: [1.2, 2.8],
    form: 'jet',
    half: [9, 13],
    speed: 760,
    splash: none,
    slowFactor: 0.35,
    slowSeconds: 3,
    stun: none,
    push: none,
  },
  light: {
    kind: 'flow',
    name: '빛 스킬',
    does: '빛줄기가 눈 깜짝할 새 날아가 지나가는 적을 모두 꿰뚫어요',
    grows: '레벨이 오르면 빛줄기가 굵어지고 더 세져요',
    tiers: ['빛살', '빛줄기', '큰 빛줄기'],
    colors: { light: '#fffbe0', mid: '#ffe066', dark: '#f0a81a', line: '#7a4d00' },
    glyph:
      'M24 17.5a6.5 6.5 0 1 0 .1 0ZM22.8 9h2.4v5h-2.4ZM22.8 34h2.4v5h-2.4ZM9 22.8h5v2.4H9ZM34 22.8h5v2.4h-5Z',
    number: '#fff08a',
    cooldown: [3.4, 2.4],
    damage: [3.6, 8.4],
    form: 'jet',
    half: [8, 16],
    speed: 1400,
    splash: none,
    slowFactor: 1,
    slowSeconds: 0,
    stun: none,
    push: none,
  },
  dark: {
    kind: 'flow',
    name: '어둠 스킬',
    does: '어둠의 물결이 천천히 넓게 쓸고 가며 적을 느리게 해요',
    grows: '레벨이 오르면 물결이 넓어지고 더 세져요',
    tiers: ['그림자', '어둠 물결', '칠흑 물결'],
    colors: { light: '#e8e4ff', mid: '#7a6ad8', dark: '#3a2f8f', line: '#17124a' },
    glyph: 'M28.5 11.5a12.6 12.6 0 1 0 7.8 21.2a10.4 10.4 0 1 1-7.8-21.2Z',
    number: '#a99cff',
    cooldown: [3, 2.2],
    damage: [2.2, 5],
    form: 'wave',
    half: [60, 105],
    speed: 300,
    splash: none,
    slowFactor: 0.5,
    slowSeconds: 2,
    stun: none,
    push: none,
  },
  sand: {
    kind: 'flow',
    name: '모래 스킬',
    does: '모래바람이 쓸고 가며 적을 밀어내고 느리게 해요',
    grows: '레벨이 오르면 더 넓게 불고 더 멀리 밀어내요',
    tiers: ['모래 먼지', '모래바람', '모래 폭풍'],
    colors: { light: '#fff4d6', mid: '#e8bf72', dark: '#b98232', line: '#5c3a0c' },
    glyph: 'M16 12h16v3.2l-5.6 8.8 5.6 8.8V36H16v-3.2l5.6-8.8-5.6-8.8Z',
    number: '#f0cf8a',
    cooldown: [2.6, 1.8],
    damage: [1.5, 3.5],
    form: 'wave',
    half: [50, 90],
    speed: 460,
    splash: none,
    slowFactor: 0.6,
    slowSeconds: 1.5,
    stun: none,
    push: [0.1, 0.2],
  },
  star: {
    kind: 'flow',
    name: '별 스킬',
    does: '별똥별이 날아가 처음 맞은 적에서 터지고 잠깐 멈춰 세워요',
    grows: '레벨이 오르면 더 자주 쏘고 더 오래 멈춰 세워요',
    tiers: ['작은 별', '별똥별', '큰 별똥별'],
    colors: { light: '#fffde0', mid: '#ffd84d', dark: '#f08a2a', line: '#7a3a08' },
    glyph: 'M24 11l3.6 8.2 8.9.9-6.7 5.9 2 8.7-7.8-4.6-7.8 4.6 2-8.7-6.7-5.9 8.9-.9Z',
    number: '#ffe680',
    cooldown: [2, 1.3],
    damage: [1.4, 3.2],
    form: 'drop',
    half: [10, 14],
    speed: 820,
    splash: [30, 50],
    slowFactor: 1,
    slowSeconds: 0,
    stun: [0.2, 0.5],
    push: none,
  },
  hail: {
    kind: 'fall',
    name: '우박 스킬',
    does: '우박이 쏟아져 둘레의 적을 때리고 얼려 멈춰 세워요',
    grows: '레벨이 오르면 우박이 더 많이 쏟아지고 더 오래 얼려요',
    tiers: ['우박 한 알', '우박', '우박 폭풍'],
    colors: { light: '#f4fdff', mid: '#9fd8f5', dark: '#3f86c8', line: '#17437a' },
    glyph:
      'M18.5 13.5a4.6 4.6 0 1 0 .1 0ZM30.5 18a4.6 4.6 0 1 0 .1 0ZM21.5 26.5a4.6 4.6 0 1 0 .1 0Z',
    number: '#bfe6ff',
    cooldown: [3.4, 2.6],
    damage: [2, 2.8],
    radius: [40, 62],
    count: [2, 2, 3, 4, 5],
    stun: [0.5, 0.9],
    slowFactor: 1,
    slowSeconds: 0,
  },
  blossom: {
    kind: 'fall',
    name: '꽃비 스킬',
    does: '꽃비가 내려 둘레의 적을 때리고 한동안 느리게 해요',
    grows: '레벨이 오르면 꽃비가 넓어지고 더 많이 내려요',
    tiers: ['꽃잎', '꽃비', '꽃보라'],
    colors: { light: '#fff0f5', mid: '#ff9fbf', dark: '#e0527f', line: '#7a1f3c' },
    glyph:
      'M24 12.5a4.4 4.4 0 1 0 .1 0ZM33.2 19.2a4.4 4.4 0 1 0 .1 0ZM29.7 30a4.4 4.4 0 1 0 .1 0ZM18.3 30a4.4 4.4 0 1 0 .1 0ZM14.8 19.2a4.4 4.4 0 1 0 .1 0Z',
    number: '#ffb3cc',
    cooldown: [3, 2.2],
    damage: [1.6, 2.4],
    radius: [50, 80],
    count: [2, 2, 3, 3, 4],
    stun: none,
    slowFactor: 0.45,
    slowSeconds: 2.5,
  },
  bomb: {
    kind: 'fall',
    name: '폭탄 스킬',
    does: '커다란 폭탄 하나가 떨어져 넓은 둘레를 한꺼번에 날려요',
    grows: '레벨이 오르면 훨씬 넓게, 훨씬 세게 터져요',
    tiers: ['폭탄', '큰 폭탄', '대폭발'],
    colors: { light: '#ffe9d6', mid: '#8b8f9c', dark: '#3d4250', line: '#14161d' },
    glyph: 'M22 18.5a9.2 9.2 0 1 0 .1 0ZM26.5 17.5l4.2-5.6 2.6 2-4.2 5.6Z',
    number: '#ffc08a',
    cooldown: [5, 3.8],
    damage: [9, 20],
    radius: [80, 130],
    count: [1, 1, 1, 1, 1],
    stun: [0.4, 0.6],
    slowFactor: 1,
    slowSeconds: 0,
  },
}

export const isFlowSpell = (spell: string): spell is FlowSpell =>
  (FLOW_SPELLS as readonly string[]).includes(spell)
export const isFallSpell = (spell: string): spell is FallSpell =>
  (FALL_SPELLS as readonly string[]).includes(spell)
export const isExtraSpell = (spell: string): spell is ExtraSpell =>
  spell === 'auroraNight' || isFlowSpell(spell) || isFallSpell(spell)
