import type { Weapon } from './hero'
import {
  earthStats,
  lightningStats,
  MAGIC_MAX_LEVEL,
  magicTier,
  meteorStats,
  waterStats,
} from './magic'
import type { WeaponKind } from './weaponEffects'

/**
 * 멘탈 카드 (decisions.md 328·330·377·392·393번). 처음 한 장, 그리고 레벨이 오를 때마다 한 장을 고른다. 효과는 한 판 안의 화면 규칙이라 앱이 가진다.
 *
 * 등급이 있다 (377번): 일반 카드는 공격력 +10%·공격 속도 +10% 두 가지뿐이고, 희귀·영웅·전설은 물·불·번개·땅 마법이다(땅은 매도벽 돌파용 충차, 433번). 마법은 총알과 따로 제 주기에 스스로
 * 나가고(392번, magic.ts), 고를 때마다 한 레벨씩 오른다. 마법 카드의 등급은 그 카드로 오르는 레벨을 보인다: Lv.1 희귀, Lv.2 영웅, Lv.3부터 전설.
 * 희귀 카드 "고양이 한 마리 더"(393번)는 사장냥과 똑같이 싸우는 고양이를 한 마리 더 부른다(최대 MAX_MATES).
 */
export type CardGrade = 'N' | 'R' | 'SR' | 'UR'
export type Magic = 'water' | 'meteor' | 'lightning' | 'earth'
export type CardCode = 'atk' | 'spd' | 'cat' | 'cat-magic' | Magic

export interface Card {
  code: CardCode
  grade: CardGrade
  name: string
  effect: string
  icon: string
  color: string
  /** 마법 카드: 지금 레벨(0이면 처음 배움)과 이 카드로 오르는 레벨. */
  level?: { from: number; to: number }
  /** 고양이 카드: 지금 함께 싸우는 고양이 수와 이 카드로 늘어난 수. */
  mates?: { from: number; to: number }
  awakening?: { from: number; to: number }
}

export const GRADE_NAMES: Record<CardGrade, string> = {
  N: '일반',
  R: '희귀',
  SR: '영웅',
  UR: '전설',
}

/** 한 칸이 마법 카드일 확률(%). */
export const MAGIC_CHANCE = 45
/** 한 칸이 "고양이 한 마리 더"일 확률(%, 393번). 고양이가 다 차면 이 몫은 일반 카드로 간다. 나머지는 일반 카드다. */
export const MATE_CHANCE = 8
export const MATE_MAGIC_CHANCE = 8
/** 함께 싸우는 고양이의 최대 수(393번, 사용자 결정): 사장냥까지 모두 넷. */
export const MAX_MATES = 3

/** 마법 카드의 등급: 이 카드로 오르는 레벨을 보인다(392번). Lv.1 희귀, Lv.2 영웅, Lv.3부터 전설. */
export function magicGrade(level: number): Exclude<CardGrade, 'N'> {
  return level <= 1 ? 'R' : level === 2 ? 'SR' : 'UR'
}

/** 일반 카드 둘 (377번): 공격력 +10%, 공격 속도 +10%. */
export const SIMPLE_CARDS: readonly Card[] = [
  {
    code: 'atk',
    grade: 'N',
    name: '존버 정신',
    effect: '공격력 +10%',
    icon: '💪',
    color: '#ffd84d',
  },
  {
    code: 'spd',
    grade: 'N',
    name: '원칙 매매',
    effect: '공격 속도 +10%',
    icon: '📏',
    color: '#8fb8ff',
  },
]

const MAGIC_INFO: Record<Magic, { name: string; icon: string; color: string }> = {
  water: {
    name: '물의 마법',
    icon: '💧',
    color: '#5ab8ff',
  },
  meteor: { name: '메테오', icon: '☄️', color: '#ff7a45' },
  lightning: {
    name: '번개 마법',
    icon: '⚡',
    color: '#ffd23f',
  },
  earth: {
    name: '충차',
    icon: '🪨',
    color: '#c08a4a',
  },
}

const LOOK_NAMES: Record<Magic, readonly [string, string, string]> = {
  water: ['물방울', '물줄기', '큰 물결'],
  meteor: ['운석', '대운석', '유성우'],
  lightning: ['번개', '번개', '번개'],
  earth: ['돌 충차', '바위 충차', '대지 충차'],
}

const pct = (k: number) => `${Math.round(k * 100)}%`

/** 카드 효과 문구: 그 레벨의 주기·연출·피해(공격력 배율)·덤 효과. */
export function magicEffect(magic: Magic, level: number): string {
  const look = LOOK_NAMES[magic][magicTier(level) - 1]
  if (magic === 'water') {
    const w = waterStats(level)
    return `${w.cooldown}초마다 ${look} · 피해 ${pct(w.damage)} · ${pct(1 - w.slowFactor)} 느리게`
  }
  if (magic === 'meteor') {
    const f = meteorStats(level)
    return `${f.cooldown}초마다 ${look} · 개당 피해 ${pct(f.damage)} · ${f.count}개 낙하 · 기절 ${f.stunSeconds}초`
  }
  if (magic === 'earth') {
    const e = earthStats(level)
    return `${e.cooldown}초마다 ${look} · 매도벽만 공격 · 피해 ${pct(e.damage * e.siege)}`
  }
  const l = lightningStats(level)
  const bolts = l.bolts > 1 ? ` ${l.bolts}줄기` : ''
  return `${l.cooldown}초마다 ${look}${bolts} · 몬스터 우선 · 피해 ${pct(l.damage)} · ${l.chains}마리 튐`
}

/** 마법 카드 한 장: 지금 레벨에서 한 레벨 올린다. */
export function magicCard(magic: Magic, from: number): Card {
  const info = MAGIC_INFO[magic]
  const to = Math.min(MAGIC_MAX_LEVEL, from + 1)
  return {
    code: magic,
    grade: magicGrade(to),
    name: info.name,
    effect: magicEffect(magic, to),
    icon: info.icon,
    color: info.color,
    level: { from, to },
  }
}

export const MAGICS: readonly Magic[] = ['water', 'meteor', 'lightning', 'earth']

/** 동료는 같은 무기로 싸우고, 각성 카드를 골라야 마법을 쓴다. */
export function mateCard(have: number): Card {
  const to = Math.min(MAX_MATES, have + 1)
  return {
    code: 'cat',
    grade: 'R',
    name: '고양이 한 마리 더',
    effect: '무기·공격력·연사는 사장냥과 똑같이 · 마법은 각성 카드로 해금',
    icon: '🐱',
    color: '#ff9db8',
    mates: { from: have, to },
  }
}

/** 마법마다 지금 레벨. */
export type MagicLevels = Record<Magic, number>

type MateMagicState = MagicLevels & { mates?: number; awakenedMates?: number }

export function awakenedMateCount(state: { mates?: number; awakenedMates?: number }): number {
  return Math.max(
    0,
    Math.min(MAX_MATES, Math.floor(state.mates ?? 0), Math.floor(state.awakenedMates ?? 0)),
  )
}

export function canAwakenMate(state: MateMagicState): boolean {
  return (
    awakenedMateCount(state) < Math.min(MAX_MATES, state.mates ?? 0) &&
    MAGICS.some((m) => state[m] > 0)
  )
}

export function mateMagicCard(have: number): Card {
  return {
    code: 'cat-magic',
    grade: 'SR',
    name: '고양이 마법 각성',
    effect: `${have + 1}번째 동료 1마리만 · 사장냥이 배운 마법을 같은 레벨로 사용`,
    icon: '🐱✨',
    color: '#c7a4ff',
    awakening: { from: have, to: Math.min(MAX_MATES, have + 1) },
  }
}

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
  /** 마법 레벨 (392번). 0이면 없다. */
  water: number
  meteor: number
  lightning: number
  /** 땅 마법 레벨 (433번): 매도벽 돌파용 충차. */
  earth: number
  /** 함께 싸우는 고양이 수 (393번, 0~MAX_MATES). */
  mates: number
  /** 소환 순서대로 마법을 해금한 동료 수. 각성 카드 한 장에 한 마리. */
  awakenedMates: number
  /** 치명타 피해 강화 (487번): 치명타 배율에 1 + 이만큼을 곱한다. */
  critBonus: number
  /** 고양이가 따로 든 총 (488번), 줄 선 차례대로. 없는 자리의 고양이는 사장냥과 같은 총을 쏜다. */
  mateGuns: MateGun[]
}

/** 고양이 한 마리의 총 (488번): 무기와 강화·고양이 레벨을 더한 수치. */
export interface MateGun {
  kind: WeaponKind
  grade: Weapon['grade']
  damage: number
  bulletPower: number
  fireMs: number
  bulletSpeed: number
  /** 이 고양이 총의 치명타 배율에 곱하는 값 (492번, 특성). 보통 1. */
  critical: number
  /** 전투 그림 (mates.ts MATE_LOOKS의 차례): 고양이마다 제 그림으로 선다. */
  look: number
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
  meteor: 0,
  lightning: 0,
  earth: 0,
  mates: 0,
  awakenedMates: 0,
  critBonus: 0,
  mateGuns: [],
}

/**
 * 든 무기의 수치(서버가 등급을 더해 준 최종값, 346번)를 한 판의 바탕 수치로. 자본으로 산 전투 강화(367·394번)가 그 위에 붙고(공격력은 그만큼
 * 오르고, 연사는 쏘는 빠르기가 그만큼 올라 간격이 1 + 비율로 나뉘고, 체력은 최대 멘탈이 그만큼 는다. 단계가 끝없어 간격을 빼면 0에 닿는다), 카드는 다시 그 위에 쌓인다.
 */
export function loadoutOf(
  weapon: {
    damagePercent: number
    fireMs: number
    power: number
    bulletSpeed: number
  },
  upgrades: ReadonlyArray<{ kind: 'damage' | 'fire' | 'hp' | 'crit'; bonusPercent: number }> = [],
): Loadout {
  const bonus = (kind: 'damage' | 'fire' | 'hp' | 'crit') =>
    (upgrades.find((u) => u.kind === kind)?.bonusPercent ?? 0) / 100
  return {
    ...BASE_LOADOUT,
    damage: (weapon.damagePercent / 100) * (1 + bonus('damage')),
    // 무기가 처음부터 가진 강화 단계(산탄총 2). 카드는 그 위에 쌓인다.
    bulletPower: Math.min(MAX_BULLET_POWER, Math.max(0, weapon.power)),
    fireMs: Math.max(60, weapon.fireMs / (1 + bonus('fire'))),
    bulletSpeed: weapon.bulletSpeed,
    // 체력 강화(410번)는 최대 멘탈을 그만큼 늘린다. 판은 가득 찬 채로 시작한다.
    maxMental: Math.round(BASE_LOADOUT.maxMental * (1 + bonus('hp'))),
    critBonus: bonus('crit'),
  }
}

/** 카드 한 장을 쌓는다. 같은 카드를 또 고르면 또 쌓인다. 마법은 등급과 상관없이 한 레벨씩 오른다(392번). 고양이는 한 마리씩 는다(393번). */
export function applyCard(loadout: Loadout, card: Card): Loadout {
  switch (card.code) {
    case 'atk':
      return { ...loadout, damage: loadout.damage * 1.1 }
    case 'spd':
      return { ...loadout, fireMs: Math.max(60, loadout.fireMs / 1.1) }
    case 'cat':
      return { ...loadout, mates: Math.min(MAX_MATES, loadout.mates + 1) }
    case 'cat-magic':
      return canAwakenMate(loadout)
        ? { ...loadout, awakenedMates: awakenedMateCount(loadout) + 1 }
        : loadout
    default:
      return { ...loadout, [card.code]: Math.min(MAGIC_MAX_LEVEL, loadout[card.code] + 1) }
  }
}

/**
 * 고를 석 장 (377·392·393번): 칸마다 MATE_CHANCE로 "고양이 한 마리 더"(다 찼으면 일반 카드), MAGIC_CHANCE로 마법, 나머지는 일반 카드. 마법은 아직
 * 최대 레벨이 아닌 것 가운데 하나를 지금 레벨의 다음 레벨 카드로 낸다. 같은 카드는 겹치지 않는다.
 */
export function pickCards(state: MateMagicState, random: () => number = Math.random): Card[] {
  const open = MAGICS.filter((m) => state[m] < MAGIC_MAX_LEVEL)
  const mates = state.mates ?? 0
  const picked: Card[] = []
  for (let tries = 0; picked.length < 3 && tries < 60; tries++) {
    let card = SIMPLE_CARDS[Math.floor(random() * SIMPLE_CARDS.length)]
    const roll = random() * 100
    if (roll < MATE_CHANCE) {
      if (mates < MAX_MATES) card = mateCard(mates)
    } else if (roll < MATE_CHANCE + MAGIC_CHANCE && open.length > 0) {
      const m = open[Math.floor(random() * open.length)]
      card = magicCard(m, state[m])
    } else if (
      roll >= MATE_CHANCE + MAGIC_CHANCE &&
      roll < MATE_CHANCE + MAGIC_CHANCE + MATE_MAGIC_CHANCE &&
      canAwakenMate(state)
    ) {
      card = mateMagicCard(awakenedMateCount(state))
    }
    if (!picked.some((c) => c.code === card.code)) {
      picked.push(card)
    }
  }
  return picked
}

/**
 * 다음 레벨까지 드는 경험치: 레벨이 오를수록 더 든다. 2분 한 판에 예닐곱 번 오르게 잡았다 (363번, 4분일 때는 120). 레벨이 너무 빨리 올라
 * 1.5배로 늘렸다 (456번, 70 → 105).
 */
export function xpToNext(level: number): number {
  return Math.round(105 * level ** 1.35)
}

/** 범위 피해가 붙는 강화 단계 (decisions.md 362번). */
export const SPLASH_FROM = 2

/**
 * 강화 수치와 연출은 같은 단계에서 계산한다. 2단계부터는 맞은 자리에서 터져 주변 적도 휘말린다: 반지름(px)과 맞은 적 피해에 대한 비율.
 */
export function bulletStats(loadout: Pick<Loadout, 'damage' | 'bulletPower'>) {
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
