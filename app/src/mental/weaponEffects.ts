import type { Weapon } from './hero'

export type WeaponKind = Weapon['kind']

/** 무기마다 다른 효과 (decisions.md 376번). 이름은 무기 고르기에 보이고, 규칙은 한 판 안의 화면 규칙이라 앱이 가진다. */
export interface WeaponEffect {
  name: string
  desc: string
}

export const WEAPON_EFFECTS: Record<WeaponKind, WeaponEffect> = {
  pistol: { name: '기본', desc: '사거리 끝없이, 재장전 없이 고르게 쏜다' },
  revolver: { name: '치명타', desc: '40% 확률로 세 배 피해 · 여섯 발마다 재장전' },
  smg: { name: '둔화', desc: '맞은 적이 1초 동안 40% 느려진다 · 탄이 흩어지고 멀리 못 간다' },
  shotgun: { name: '폭발', desc: '맞은 자리에서 크게 터지고 적을 밀어낸다 · 가까이만 닿는다' },
  rifle: { name: '관통', desc: '탄이 적을 뚫고 지나가 넷까지 맞힌다 · 가장 느리게 쏜다' },
}

/**
 * 무기마다 극명한 강점과 약점 (decisions.md 430번, #587): 잘 맞는 상황(떼 적·보스·빠른 적·가까이 붙은 적)과 안 맞는 상황이 갈린다. 공격·연사 간격은
 * 서버(`mental.weapons`)가, 사거리·재장전·밀어내기 같은 한 판 안의 규칙은 앱이 가진다(376번처럼).
 */
export interface WeaponTraits {
  /** 강점·약점 한 줄: 인벤토리·출전 화면에 보인다. */
  strength: string
  weakness: string
  /** 탄이 날아가는 거리(화면 높이의 비율). null이면 끝없이(화면 밖까지). */
  range: number | null
  /** 한 번에 쏘는 탄 수와 다 쏘면 쉬는 재장전 시간(ms). magazine이 null이면 재장전이 없다. */
  magazine: number | null
  reloadMs: number
  /** 맞은 적을 밀어내는 빠르기(px/s). 0이면 밀지 않는다. 보스·매도벽은 밀리지 않는다. */
  knockback: number
}

export const WEAPON_TRAITS: Record<WeaponKind, WeaponTraits> = {
  pistol: {
    strength: '고르게 강함 · 사거리 끝없음',
    weakness: '특별히 센 상황이 없다',
    range: null,
    magazine: null,
    reloadMs: 0,
    knockback: 0,
  },
  revolver: {
    strength: '보스·단단한 적에 강함',
    weakness: '떼로 오면 막기 어렵다',
    range: null,
    magazine: 6,
    reloadMs: 1000,
    knockback: 0,
  },
  smg: {
    strength: '떼 적·빠른 적에 강함',
    weakness: '보스·멀리 있는 적에 약함',
    range: 0.85,
    magazine: null,
    reloadMs: 0,
    knockback: 0,
  },
  shotgun: {
    strength: '가까이 몰린 적에 강함',
    weakness: '멀리 있는 적을 못 맞힌다',
    range: 0.6,
    magazine: null,
    reloadMs: 0,
    knockback: 520,
  },
  rifle: {
    strength: '줄지은 적·보스에 강함',
    weakness: '가까이 붙은 떼에 약함',
    range: null,
    magazine: null,
    reloadMs: 0,
    knockback: 0,
  },
}

/** 리볼버 치명타: 확률과 배율. */
export const CRIT_CHANCE = 0.4
export const CRIT_MULT = 3

/** 기관단총 둔화: 이어지는 시간(초)과 그동안의 빠르기 배율. */
export const SLOW_SECONDS = 1
export const SLOW_FACTOR = 0.6

/** 소총 관통: 탄 하나가 맞히는 적의 수. 다른 무기는 하나. */
export const RIFLE_PIERCE = 4

/** 한 발의 피해와 치명타 여부. roll은 0~1 난수(테스트에서 고정). */
export function weaponDamage(kind: WeaponKind, damage: number, roll: number) {
  const crit = kind === 'revolver' && roll < CRIT_CHANCE
  return { damage: crit ? damage * CRIT_MULT : damage, crit }
}

/** 탄 하나가 맞힐 수 있는 적의 수. */
export function pierceOf(kind: WeaponKind): number {
  return kind === 'rifle' ? RIFLE_PIERCE : 1
}

/**
 * 무기마다 쏘는 방식 (#563): 탄 모양·빛·흩어짐, 총구 화염, 반동, 꼬리, 소리가 다르다(화면 흔들림은 408번에서 뺐다). 수치(공격·연사·탄속)와 효과(376번)는 그대로이고
 * 한 발씩 한 줄로 나간다(362번: 갈래는 없다). 산탄총은 굵은 산탄 한 덩이에 부채꼴로 터지는 총구 화염, 기관단총은 살짝 흩뿌린다.
 */
export interface FireStyle {
  /** 쏘는 방향의 흔들림(라디안, ±). 기관단총만 흩어진다. */
  jitter: number
  /** 탄 길이·굵기 배율(탄 강화 단계 배율 위에 곱한다). */
  length: number
  width: number
  /** 탄 빛. */
  tint: number
  /** 총구 화염 크기 배율과 이어지는 시간(ms). */
  flash: number
  flashMs: number
  /** 쏠 때 몸이 눌리는 정도(1 = 권총). */
  recoil: number
  /** 탄 꼬리를 남기는 간격(ms). 작을수록 촘촘하다. */
  trailMs: number
  /** 쏠 때 화염 둘레로 튀는 불꽃 수(산탄총 부채꼴). */
  sparks: number
}

export const FIRE_STYLES: Record<WeaponKind, FireStyle> = {
  pistol: {
    jitter: 0,
    length: 1,
    width: 1,
    tint: 0xffffff,
    flash: 1,
    flashMs: 90,
    recoil: 1,
    trailMs: 32,
    sparks: 0,
  },
  revolver: {
    jitter: 0,
    length: 1.25,
    width: 1.45,
    tint: 0xffb24a,
    flash: 1.7,
    flashMs: 140,
    recoil: 2,
    trailMs: 24,
    sparks: 0,
  },
  smg: {
    jitter: 0.08,
    length: 0.8,
    width: 0.72,
    tint: 0xfff1a8,
    flash: 0.65,
    flashMs: 55,
    recoil: 0.45,
    trailMs: 64,
    sparks: 0,
  },
  shotgun: {
    jitter: 0,
    length: 0.9,
    width: 1.9,
    tint: 0xff7a45,
    flash: 2,
    flashMs: 120,
    recoil: 2.4,
    trailMs: 32,
    sparks: 7,
  },
  rifle: {
    jitter: 0,
    length: 2.2,
    width: 0.75,
    tint: 0x9ff3ff,
    flash: 1.2,
    flashMs: 80,
    recoil: 1.4,
    trailMs: 8,
    sparks: 0,
  },
}

/** 쏘는 방향: 흩어지는 무기면 roll(0~1)로 ±jitter 안에서 흔든다. */
export function aimWithJitter(kind: WeaponKind, base: number, roll: number): number {
  const j = FIRE_STYLES[kind].jitter
  return j ? base + (roll * 2 - 1) * j : base
}

/** 무기마다 쏘는 방식의 짧은 이름 (#563): 인벤토리·출전 화면에 보인다. */
export const FIRE_STYLE_NAMES: Record<WeaponKind, string> = {
  pistol: '고른 한 발',
  revolver: '묵직한 한 발',
  smg: '흩뿌리는 연사',
  shotgun: '굵은 산탄 한 덩이',
  rifle: '길고 곧은 탄',
}
