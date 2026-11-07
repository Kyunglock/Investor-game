import type { MentalCard } from '@web/features/raising/store'

/** 멘탈 카드 한 장 (decisions.md 320번). 효과는 한 판 안의 화면 규칙이라 앱이 가진다. 이름은 서버 콘텐츠(company.mental.cards)와 같다. */
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
    name: '분산 투자',
    desc: '한곳에 몰지 않는다',
    effect: '탄이 세 갈래',
    icon: '🔱',
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
    effect: '멘탈 +50',
    icon: '🛡️',
    color: '#ff7aa8',
  },
  {
    code: 'calm',
    name: '냉정함',
    desc: '급할수록 침착하게',
    effect: '이동 +35%',
    icon: '🧊',
    color: '#cfe9ff',
  },
]

/** 한 판 앞에 보이는 석 장: 다섯 가운데 서로 다른 셋. */
export function pickCards(random: () => number = Math.random): Card[] {
  const pool = [...CARDS]
  const picked: Card[] = []
  while (picked.length < 3) {
    const i = Math.floor(random() * pool.length)
    picked.push(...pool.splice(i, 1))
  }
  return picked
}

/** 카드가 바꾸는 한 판의 수치. */
export interface Loadout {
  damage: number
  spread: boolean
  fireMs: number
  maxMental: number
  speed: number
}

const BASE: Loadout = { damage: 1, spread: false, fireMs: 260, maxMental: 100, speed: 260 }

export function loadoutOf(card: MentalCard): Loadout {
  switch (card) {
    case 'hold':
      return { ...BASE, damage: 1.6 }
    case 'split':
      return { ...BASE, spread: true }
    case 'rule':
      return { ...BASE, fireMs: 260 / 1.45 }
    case 'steel':
      return { ...BASE, maxMental: 150 }
    case 'calm':
      return { ...BASE, speed: 260 * 1.35 }
  }
}
