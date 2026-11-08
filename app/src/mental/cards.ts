import type { MentalCard } from '@web/features/raising/store'

/**
 * 멘탈 카드 (decisions.md 328·330번). 처음 한 장, 그리고 레벨이 오를 때마다 한 장을 고른다. 효과는 한 판 안의 화면 규칙이라 앱이 가진다. 이름은 서버
 * 콘텐츠(company.mental.cards)와 같다.
 */
export interface Card {
  code: MentalCard
  name: string
  desc: string
  effect: string
  icon: string
  color: string
}

export const CARDS: readonly Card[] = [
  {
    code: 'hold',
    name: '존버 정신',
    desc: '흔들려도 버틴다',
    effect: '공격력 +60%',
    icon: '💪',
    color: '#ffd84d',
  },
  {
    code: 'split',
    name: '총알 강화',
    desc: '한 발에 힘을 응축한다',
    effect: '탄 위력 +40% · 크기 +20% · 2단계부터 폭발',
    icon: '💥',
    color: '#7be0c3',
  },
  {
    code: 'rule',
    name: '원칙 매매',
    desc: '정한 대로만 쏜다',
    effect: '연사 +45%',
    icon: '📏',
    color: '#8fb8ff',
  },
  {
    code: 'steel',
    name: '강철 멘탈',
    desc: '웬만해선 안 무너진다',
    effect: '최대 멘탈 +50, 회복',
    icon: '🛡️',
    color: '#ff7aa8',
  },
  {
    code: 'calm',
    name: '냉정함',
    desc: '급할수록 침착하게',
    effect: '탄이 더 빠르고 멀리',
    icon: '🧊',
    color: '#cfe9ff',
  },
  {
    code: 'heal',
    name: '심호흡',
    desc: '후… 하고 한숨 돌린다',
    effect: '멘탈 +40 회복',
    icon: '🌬️',
    color: '#d9f5c2',
  },
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
}

export const BASE_LOADOUT: Loadout = {
  damage: 1,
  bulletPower: 0,
  fireMs: 260,
  maxMental: 100,
  bulletSpeed: 720,
  heal: 0,
}

/** 든 무기의 수치(서버가 등급을 더해 준 최종값, 346번)를 한 판의 바탕 수치로. 카드는 그 위에 쌓인다. */
export function loadoutOf(weapon: {
  damagePercent: number
  fireMs: number
  power: number
  bulletSpeed: number
}): Loadout {
  return {
    ...BASE_LOADOUT,
    damage: weapon.damagePercent / 100,
    // 무기가 처음부터 가진 강화 단계(산탄총 2). 카드는 그 위에 쌓인다.
    bulletPower: Math.min(MAX_BULLET_POWER, Math.max(0, weapon.power)),
    fireMs: weapon.fireMs,
    bulletSpeed: weapon.bulletSpeed,
  }
}

/** 카드 한 장을 쌓는다. 같은 카드를 또 고르면 또 쌓인다. */
export function applyCard(loadout: Loadout, card: MentalCard): Loadout {
  switch (card) {
    case 'hold':
      return { ...loadout, damage: loadout.damage + 0.6 }
    case 'split':
      return { ...loadout, bulletPower: Math.min(MAX_BULLET_POWER, loadout.bulletPower + 1) }
    case 'rule':
      return { ...loadout, fireMs: Math.max(80, loadout.fireMs / 1.45) }
    case 'steel':
      return { ...loadout, maxMental: loadout.maxMental + 50, heal: 50 }
    case 'calm':
      return { ...loadout, bulletSpeed: loadout.bulletSpeed + BASE_LOADOUT.bulletSpeed * 0.3 }
    case 'heal':
      return { ...loadout, heal: 40 }
  }
}

/** 고를 석 장: 서로 다른 셋. 총알 강화가 최대면 해당 카드는 빼고, 멘탈이 꽉 차 있으면 심호흡은 뺀다. */
export function pickCards(
  loadout: Loadout = BASE_LOADOUT,
  mentalFull = true,
  random: () => number = Math.random,
): Card[] {
  const pool = CARDS.filter(
    (c) =>
      !(c.code === 'split' && loadout.bulletPower >= MAX_BULLET_POWER) &&
      !(c.code === 'heal' && mentalFull),
  )
  const picked: Card[] = []
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(random() * pool.length)
    picked.push(...pool.splice(i, 1))
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
