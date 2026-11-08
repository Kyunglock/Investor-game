import type { Weapon } from './hero'

export type WeaponKind = Weapon['kind']

/** 무기마다 다른 효과 (decisions.md 376번). 이름은 무기 고르기에 보이고, 규칙은 한 판 안의 화면 규칙이라 앱이 가진다. */
export interface WeaponEffect {
  name: string
  desc: string
}

export const WEAPON_EFFECTS: Record<WeaponKind, WeaponEffect> = {
  pistol: { name: '기본', desc: '특별한 효과 없이 고르게 쏜다' },
  revolver: { name: '치명타', desc: '30% 확률로 두 배 피해' },
  smg: { name: '둔화', desc: '맞은 적이 1초 동안 40% 느려진다' },
  shotgun: { name: '폭발', desc: '맞은 자리에서 터져 주변 적도 휘말린다' },
  rifle: { name: '관통', desc: '탄이 적을 뚫고 지나가 셋까지 맞힌다' },
}

/** 리볼버 치명타: 확률과 배율. */
export const CRIT_CHANCE = 0.3
export const CRIT_MULT = 2

/** 기관단총 둔화: 이어지는 시간(초)과 그동안의 빠르기 배율. */
export const SLOW_SECONDS = 1
export const SLOW_FACTOR = 0.6

/** 소총 관통: 탄 하나가 맞히는 적의 수. 다른 무기는 하나. */
export const RIFLE_PIERCE = 3

/** 한 발의 피해와 치명타 여부. roll은 0~1 난수(테스트에서 고정). */
export function weaponDamage(kind: WeaponKind, damage: number, roll: number) {
  const crit = kind === 'revolver' && roll < CRIT_CHANCE
  return { damage: crit ? damage * CRIT_MULT : damage, crit }
}

/** 탄 하나가 맞힐 수 있는 적의 수. */
export function pierceOf(kind: WeaponKind): number {
  return kind === 'rifle' ? RIFLE_PIERCE : 1
}
