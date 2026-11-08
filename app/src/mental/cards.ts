/**
 * 멘탈 카드 (decisions.md 328·330·377번). 처음 한 장, 그리고 레벨이 오를 때마다 한 장을 고른다. 효과는 한 판 안의 화면 규칙이라 앱이 가진다.
 *
 * 등급이 있다 (377번): 일반 카드는 공격력 +10%·공격 속도 +10% 두 가지뿐이고, 희귀·영웅·전설은 물·불·번개 마법이다. 등급이 높을수록 드물고
 * 마법이 세다(같은 마법을 또 고르면 단계가 쌓인다).
 */
export type CardGrade = 'N' | 'R' | 'SR' | 'UR'
export type Magic = 'water' | 'fire' | 'lightning'
export type CardCode = 'atk' | 'spd' | Magic

export interface Card {
  code: CardCode
  grade: CardGrade
  name: string
  desc: string
  effect: string
  icon: string
  color: string
}

export const GRADE_NAMES: Record<CardGrade, string> = {
  N: '일반',
  R: '희귀',
  SR: '영웅',
  UR: '전설',
}

/** 등급마다 나올 확률(%). 한 칸마다 따로 굴린다. */
export const GRADE_ODDS: Record<CardGrade, number> = { N: 55, R: 28, SR: 13, UR: 4 }

/** 마법 카드 한 장이 올리는 단계: 희귀 1, 영웅 2, 전설 3. */
export const MAGIC_LEVEL: Record<Exclude<CardGrade, 'N'>, number> = { R: 1, SR: 2, UR: 3 }

/** 일반 카드 둘 (377번): 공격력 +10%, 공격 속도 +10%. */
export const SIMPLE_CARDS: readonly Card[] = [
  {
    code: 'atk',
    grade: 'N',
    name: '존버 정신',
    desc: '흔들려도 버틴다',
    effect: '공격력 +10%',
    icon: '💪',
    color: '#ffd84d',
  },
  {
    code: 'spd',
    grade: 'N',
    name: '원칙 매매',
    desc: '정한 대로만 쏜다',
    effect: '공격 속도 +10%',
    icon: '📏',
    color: '#8fb8ff',
  },
]

const MAGIC_INFO: Record<Magic, { name: string; desc: string; icon: string; color: string }> = {
  water: { name: '물의 마법', desc: '차가운 물이 발을 묶는다', icon: '💧', color: '#5ab8ff' },
  fire: { name: '불의 마법', desc: '맞은 적이 활활 탄다', icon: '🔥', color: '#ff7a45' },
  lightning: { name: '번개 마법', desc: '번개가 옆 적에게 튄다', icon: '⚡', color: '#ffd23f' },
}

/** 물: 단계마다 맞은 적이 이만큼(%) 느려지고(최대 70%), 1초 + 단계 × 0.5초 동안 이어진다. */
export function waterSlow(level: number) {
  return { factor: 1 - Math.min(0.7, 0.2 * level), seconds: 1 + 0.5 * level }
}

/** 불: 맞은 적이 2초 동안 초마다 맞은 피해 × 단계 × 30%만큼 탄다. */
export const BURN_SECONDS = 2
export function burnPerSecond(damage: number, level: number): number {
  return damage * 0.3 * level
}

/** 번개: 맞은 적 곁(반지름 150px)의 적 단계 수만큼에게 맞은 피해의 60%가 튄다. */
export const CHAIN_RADIUS = 150
export function chainOf(damage: number, level: number) {
  return { targets: level, damage: damage * 0.6 }
}

function magicEffect(magic: Magic, level: number): string {
  if (magic === 'water') {
    const w = waterSlow(level)
    return `맞은 적 ${Math.round((1 - w.factor) * 100)}% 느리게 · ${w.seconds}초`
  }
  if (magic === 'fire') {
    return `2초 동안 화상 · 초당 피해 ${level * 30}%`
  }
  return `옆 적 ${level}마리에게 번개 · 피해 60%`
}

/** 마법 카드 한 장 (등급별). */
export function magicCard(magic: Magic, grade: Exclude<CardGrade, 'N'>): Card {
  const info = MAGIC_INFO[magic]
  return {
    code: magic,
    grade,
    name: info.name,
    desc: info.desc,
    effect: magicEffect(magic, MAGIC_LEVEL[grade]),
    icon: info.icon,
    color: info.color,
  }
}

const MAGICS: readonly Magic[] = ['water', 'fire', 'lightning']

/** 나올 수 있는 모든 카드: 일반 둘 + 마법 셋 × 등급 셋. */
export const CARDS: readonly Card[] = [
  ...SIMPLE_CARDS,
  ...MAGICS.flatMap((m) => (['R', 'SR', 'UR'] as const).map((g) => magicCard(m, g))),
]

/** 총알 강화는 세 단계까지 쌓인다. */
export const MAX_BULLET_POWER = 3

/** 한 판의 수치. 카드를 고를 때마다 쌓인다. */
export interface Loadout {
  damage: number
  /** 총알 강화 단계. 발사 방향은 항상 한 줄이다. */
  bulletPower: number
  fireMs: number
  maxMental: number
  /** 탄의 빠르기(px/s). 날아가는 시간은 같아서 빠를수록 멀리 간다. */
  bulletSpeed: number
  /** 이번 카드로 바로 회복할 멘탈. 전투가 적용하고 0으로 돌린다. */
  heal: number
  /** 전진 모드에서 사장냥이 손가락을 따라가는 최대 빠르기(px/s, 364번). */
  moveSpeed: number
  /** 마법 단계 (377번). 0이면 없다. */
  water: number
  fire: number
  lightning: number
}

export const BASE_LOADOUT: Loadout = {
  damage: 1,
  bulletPower: 0,
  fireMs: 260,
  maxMental: 100,
  bulletSpeed: 720,
  heal: 0,
  moveSpeed: 520,
  water: 0,
  fire: 0,
  lightning: 0,
}

/**
 * 든 무기의 수치(서버가 등급을 더해 준 최종값, 346번)를 한 판의 바탕 수치로. 자본으로 산 전투 강화(367·394번)가 그 위에 붙고(공격력은 그만큼
 * 오르고, 연사는 쏘는 빠르기가 그만큼 올라 간격이 1 + 비율로 나뉜다. 단계가 끝없어 간격을 빼면 0에 닿는다), 카드는 다시 그 위에 쌓인다.
 */
export function loadoutOf(
  weapon: {
    damagePercent: number
    fireMs: number
    power: number
    bulletSpeed: number
  },
  upgrades: ReadonlyArray<{ kind: 'damage' | 'fire'; bonusPercent: number }> = [],
): Loadout {
  const bonus = (kind: 'damage' | 'fire') =>
    (upgrades.find((u) => u.kind === kind)?.bonusPercent ?? 0) / 100
  return {
    ...BASE_LOADOUT,
    damage: (weapon.damagePercent / 100) * (1 + bonus('damage')),
    // 무기가 처음부터 가진 강화 단계(산탄총 2). 카드는 그 위에 쌓인다.
    bulletPower: Math.min(MAX_BULLET_POWER, Math.max(0, weapon.power)),
    fireMs: Math.max(60, weapon.fireMs / (1 + bonus('fire'))),
    bulletSpeed: weapon.bulletSpeed,
  }
}

/** 카드 한 장을 쌓는다. 같은 카드를 또 고르면 또 쌓인다. */
export function applyCard(loadout: Loadout, card: Card): Loadout {
  switch (card.code) {
    case 'atk':
      return { ...loadout, damage: loadout.damage * 1.1 }
    case 'spd':
      return { ...loadout, fireMs: Math.max(60, loadout.fireMs / 1.1) }
    default:
      return {
        ...loadout,
        [card.code]: loadout[card.code] + MAGIC_LEVEL[card.grade as Exclude<CardGrade, 'N'>],
      }
  }
}

/** 한 칸의 등급을 굴린다. */
export function rollGrade(random: () => number = Math.random): CardGrade {
  let r = random() * 100
  for (const g of ['UR', 'SR', 'R'] as const) {
    if (r < GRADE_ODDS[g]) {
      return g
    }
    r -= GRADE_ODDS[g]
  }
  return 'N'
}

/** 고를 석 장 (377번): 칸마다 등급을 굴려 일반이면 일반 카드, 아니면 그 등급의 마법 하나. 같은 카드(종류·등급)는 겹치지 않는다. */
export function pickCards(random: () => number = Math.random): Card[] {
  const picked: Card[] = []
  for (let tries = 0; picked.length < 3 && tries < 60; tries++) {
    const grade = rollGrade(random)
    const card =
      grade === 'N'
        ? SIMPLE_CARDS[Math.floor(random() * SIMPLE_CARDS.length)]
        : magicCard(MAGICS[Math.floor(random() * MAGICS.length)], grade)
    if (!picked.some((c) => c.code === card.code && c.grade === card.grade)) {
      picked.push(card)
    }
  }
  return picked
}

/** 다음 레벨까지 드는 경험치: 레벨이 오를수록 더 든다. 2분 한 판에 예닐곱 번 오르게 잡았다 (363번, 4분일 때는 120). */
export function xpToNext(level: number): number {
  return Math.round(70 * level ** 1.35)
}

/** 범위 피해가 붙는 강화 단계 (decisions.md 362번). */
export const SPLASH_FROM = 2

/**
 * 강화 수치와 연출은 같은 단계에서 계산한다. 2단계부터는 맞은 자리에서 터져 주변 적도 휘말린다: 반지름(px)과 맞은 적 피해에 대한 비율.
 */
export function bulletStats(loadout: Loadout) {
  const power = Math.min(MAX_BULLET_POWER, Math.max(0, loadout.bulletPower))
  const damage = loadout.damage * (1 + power * 0.4)
  const splash = power >= SPLASH_FROM
  return {
    damage,
    scale: 1 + power * 0.2,
    power,
    splashRadius: splash ? 40 + (power - SPLASH_FROM) * 20 : 0,
    splashDamage: splash ? damage * 0.5 : 0,
  }
}
