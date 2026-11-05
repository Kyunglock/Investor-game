import type { Grade } from '../../api/client'
import { LADDER } from './grades'

/**
 * 회사 건물과 객장 (증권사 육성 설계 8.1절). 위층은 사무실(책상 수 = 자리 수), 아래층은 객장(손님 = 매출). 회사 등급이 오르면 건물이 바뀐다. 표에 없는
 * 등급(E·C·A·SS)은 앞 단계 그림에 소품을 더한다.
 */
export type Tier = 'basement' | 'shop' | 'small' | 'yeouido' | 'whole' | 'hq' | 'landmark'

const TIERS: Record<Grade, Tier> = {
  F: 'basement',
  E: 'basement',
  D: 'shop',
  C: 'shop',
  B: 'small',
  A: 'small',
  S: 'yeouido',
  SS: 'yeouido',
  SSS: 'whole',
  X: 'hq',
  XX: 'hq',
  XXX: 'hq',
  Z: 'landmark',
  ZZ: 'landmark',
  ZZZ: 'landmark',
}

export function tierOf(grade: Grade): Tier {
  return TIERS[grade]
}

/** 표에 없는 등급은 소품 하나를 더한다(화분). */
export function hasProp(grade: Grade): boolean {
  return ['E', 'C', 'A', 'SS', 'XX', 'XXX', 'ZZ', 'ZZZ'].includes(grade)
}

const OFFICE_NAMES: Record<Tier, string> = {
  basement: '반지하 원룸',
  shop: '상가 2층',
  small: '작은 빌딩 한 층',
  yeouido: '여의도 빌딩 몇 층',
  whole: '여의도 빌딩 통째로',
  hq: '우리 이름이 붙은 사옥',
  landmark: '랜드마크 타워',
}

/** 객장 손님 수: 고객이 돈을 더 맡긴다를 사람으로 그린다. F는 손님 대신 길고양이 한 마리. */
export function customersOf(grade: Grade): number {
  return Math.min(LADDER.indexOf(grade), 8)
}

/** 객장 소품: B부터 번호표 기계, S부터 대기 의자, SSS부터 문밖까지 줄, X부터 전광판에 우리 시세, Z부터 스카이라인에 우리 로고. */
export function lobbyOf(grade: Grade): {
  ticket: boolean
  chairs: boolean
  line: boolean
  board: boolean
  logo: boolean
} {
  const at = LADDER.indexOf(grade)
  return {
    ticket: at >= LADDER.indexOf('B'),
    chairs: at >= LADDER.indexOf('S'),
    line: at >= LADDER.indexOf('SSS'),
    board: at >= LADDER.indexOf('X'),
    logo: at >= LADDER.indexOf('Z'),
  }
}

/** 그림을 끄면 같은 내용을 글로 (decisions.md 190번, 8.4절). */
export function officeCaption(grade: Grade, seats: number): string {
  const customers = customersOf(grade)
  const lobby = lobbyOf(grade)
  const guests =
    customers === 0
      ? '손님 없음, 길고양이 한 마리'
      : lobby.line
        ? '줄이 문밖까지'
        : lobby.chairs
          ? '대기 의자가 꽉 참'
          : customers >= 4
            ? `손님 ${customers}명, 번호표 기계`
            : `손님 ${customers}명`
  return `사무실: ${OFFICE_NAMES[tierOf(grade)]}, 책상 ${seats}개 · 객장: ${guests}`
}

/** 직원 차림새 (8.2절): F 후드티 → B 셔츠 → S 정장 → SSS 맞춤 정장. X 이상은 맞춤 정장에 빛이 돈다. */
export type Attire = 'hoodie' | 'shirt' | 'suit' | 'tailored'

export function attireOf(grade: Grade): Attire {
  const at = LADDER.indexOf(grade)
  if (at >= LADDER.indexOf('SSS')) {
    return 'tailored'
  }
  if (at >= LADDER.indexOf('S')) {
    return 'suit'
  }
  return at >= LADDER.indexOf('B') ? 'shirt' : 'hoodie'
}

export const ATTIRE_NAMES: Record<Attire, string> = {
  hoodie: '후드티',
  shirt: '셔츠',
  suit: '정장',
  tailored: '맞춤 정장',
}

/** X·XX·XXX는 파란빛, Z·ZZ·ZZZ는 금빛. 사무실만 봐도 금빛이 몇 명인지 보인다 (8.2절). */
export function glowOf(grade: Grade): 'blue' | 'gold' | null {
  if (grade.startsWith('Z')) {
    return 'gold'
  }
  return grade.startsWith('X') ? 'blue' : null
}

/**
 * 차림새의 옷·바지 색. 캐릭터 팔레트 글자(윗옷 q·d·c·C, 바지 z·P·p·u: 윤곽·그림자·기본·밝은 쪽)를 바꾼다 (palette.ts CHARACTER_PALETTE,
 * looks.ts와 같은 방식).
 */
export const ATTIRE_COLORS: Record<Attire, Record<string, string>> = {
  hoodie: {
    q: '#4a4d52',
    d: '#6b6f76',
    c: '#8d9199',
    C: '#adb1b8',
    z: '#2b3442',
    P: '#3d4a5e',
    p: '#53627a',
    u: '#6d7d96',
  },
  shirt: {
    q: '#5b7a99',
    d: '#8fb0cc',
    c: '#c4dbee',
    C: '#e3eff8',
    z: '#2a2f3a',
    P: '#3c4352',
    p: '#525b6e',
    u: '#6a7488',
  },
  suit: {
    q: '#0f1a2e',
    d: '#1d2c48',
    c: '#2c3f64',
    C: '#3f5682',
    z: '#0f1a2e',
    P: '#1d2c48',
    p: '#2c3f64',
    u: '#3f5682',
  },
  tailored: {
    q: '#0b0b0f',
    d: '#1b1b22',
    c: '#2b2b35',
    C: '#45454f',
    z: '#0b0b0f',
    P: '#1b1b22',
    p: '#2b2b35',
    u: '#45454f',
  },
}
