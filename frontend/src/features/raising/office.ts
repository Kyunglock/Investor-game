import type { Company, Grade } from '../../api/client'
import { EMPLOYEE_LADDER, LADDER } from './grades'

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
  // 직원에게만 있는 등급 (289번). 회사는 ZZZ까지다.
  XS: 'landmark',
  XSS: 'landmark',
  GOD: 'landmark',
}

export function tierOf(grade: Grade): Tier {
  return TIERS[grade]
}

/** 표에 없는 등급은 소품 하나를 더한다(화분). */
export function hasProp(grade: Grade): boolean {
  return ['E', 'C', 'A', 'SS', 'XX', 'XXX', 'ZZ', 'ZZZ'].includes(grade)
}

export const OFFICE_NAMES: Record<Tier, string> = {
  basement: '반지하 원룸',
  shop: '상가 2층',
  small: '작은 빌딩 한 층',
  yeouido: '여의도 빌딩 몇 층',
  whole: '여의도 빌딩 통째로',
  hq: '우리 이름이 붙은 사옥',
  landmark: '랜드마크 타워',
}

/** 건물 단계 순서. 회사 화면은 회사 등급 글자 대신 건물로 보인다 (decisions.md 238번). */
export const TIER_ORDER: Tier[] = [
  'basement',
  'shop',
  'small',
  'yeouido',
  'whole',
  'hq',
  'landmark',
]

/** 건물 사다리의 짧은 이름 */
export const TIER_SHORT: Record<Tier, string> = {
  basement: '반지하',
  shop: '상가',
  small: '작은 빌딩',
  yeouido: '여의도',
  whole: '빌딩 통째',
  hq: '사옥',
  landmark: '랜드마크',
}

export function officeName(grade: Grade): string {
  return OFFICE_NAMES[tierOf(grade)]
}

/**
 * 다음 단계 한 줄: 다음 등급이 다른 건물이면 이사, 같은 건물이면 사무실을 넓혀 책상을 들인다(359번). 자본 띠는 서버가 준다(nextGradeCapital). 끝 등급이면 null.
 */
export function nextStep(grade: Grade): { kind: 'move'; to: string } | { kind: 'expand' } | null {
  const next = LADDER[LADDER.indexOf(grade) + 1]
  if (!next) {
    return null
  }
  return tierOf(next) === tierOf(grade)
    ? { kind: 'expand' }
    : { kind: 'move', to: OFFICE_NAMES[tierOf(next)] }
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
  const at = EMPLOYEE_LADDER.indexOf(grade)
  if (at >= EMPLOYEE_LADDER.indexOf('SSS')) {
    return 'tailored'
  }
  if (at >= EMPLOYEE_LADDER.indexOf('S')) {
    return 'suit'
  }
  return at >= EMPLOYEE_LADDER.indexOf('B') ? 'shirt' : 'hoodie'
}

export const ATTIRE_NAMES: Record<Attire, string> = {
  hoodie: '후드티',
  shirt: '셔츠',
  suit: '정장',
  tailored: '맞춤 정장',
}

/** X·XX·XXX는 파란빛, Z·ZZ·ZZZ와 그 위(XS·XSS·GOD, 289번)는 금빛. 사무실만 봐도 금빛이 몇 명인지 보인다 (8.2절). */
export function glowOf(grade: Grade): 'blue' | 'gold' | null {
  if (EMPLOYEE_LADDER.indexOf(grade) >= EMPLOYEE_LADDER.indexOf('Z')) {
    return 'gold'
  }
  return grade.startsWith('X') ? 'blue' : null
}

/** 사무실 바닥 무늬 (미니맵, decisions.md 237번): 반지하·상가는 시멘트, 빌딩은 나무 마루, 사옥부터 대리석. */
export const FLOORS: Record<Tier, [string, string]> = {
  basement: ['#c9c6bf', '#bdb9b1'],
  shop: ['#cfc8bb', '#c3bbad'],
  small: ['#d9c3a2', '#cfb692'],
  yeouido: ['#d9c3a2', '#cfb692'],
  whole: ['#dcc9ab', '#d1bb98'],
  hq: ['#e8e4dc', '#dcd6cb'],
  landmark: ['#ece4cf', '#e2d5b4'],
}

type Employee = Company['employees'][number]

export interface SeatTile {
  /** 자리 번호(0부터). 빈 자리를 고를 때 쓴다 */
  index: number
  employee: Employee | null
  /** 앉은 자리 이름 */
  desk: string | null
  /** 돈을 굴리는 자리면 참 */
  trades: boolean
  /** 지난 결산 손익. 판돈이 없었으면 null */
  pnl: number | null
  /** 정면 얼굴 표정: 벌었으면 웃고, 잃었으면 처진다 */
  mood: 'joy' | 'despair' | null
}

/**
 * 사무실 미니맵의 칸 (decisions.md 237번). 자리 수만큼 칸이 있고, 앉은 사람이 앞에서부터 채우고 남은 칸은 빈 자리다. 쉬는 사람은 칸 밖(휴게실)에 따로
 * 선다.
 */
export function seatTiles(company: Company): { tiles: SeatTile[]; resting: Employee[] } {
  const seated = company.employees.filter((e) => e.desk)
  const results = new Map((company.lastSettlement?.results ?? []).map((r) => [r.employeeId, r]))
  const desks = new Map(company.desks.map((d) => [d.code, d]))
  const tiles = Array.from({ length: company.seats }, (_, index): SeatTile => {
    const employee = seated[index] ?? null
    if (!employee) {
      return { index, employee, desk: null, trades: false, pnl: null, mood: null }
    }
    const desk = desks.get(employee.desk ?? '')
    const r = results.get(employee.id)
    // 돈을 굴리는 자리에만 운용 손익 배지를 단다 (#346): 해 가운데 발굴팀으로 옮긴 사람에게 지난 운용 손익이 붙었다.
    const pnl = r && r.stake > 0 && desk?.trades ? r.pnl : null
    return {
      index,
      employee,
      desk: desk?.name ?? null,
      trades: desk?.trades ?? false,
      pnl,
      mood: pnl === null || pnl === 0 ? null : pnl > 0 ? 'joy' : 'despair',
    }
  })
  return { tiles, resting: company.employees.filter((e) => !e.desk) }
}

/**
 * 직함 (decisions.md 256번): 이름에서 떼어 종합 등급으로 붙인다. 차림새(8.2절)처럼 등급이 오르면 직함도 오른다. 전에는 이름에 직함이 붙어 있어("이수습") SSS
 * 에이스도 수습이었다.
 */
const TITLES: [Grade, string][] = [
  ['GOD', '신'],
  ['XSS', '고문'],
  ['XS', '부사장'],
  ['Z', '전무'],
  ['X', '이사'],
  ['SSS', '부장'],
  ['SS', '차장'],
  ['S', '과장'],
  ['A', '대리'],
  ['C', '주임'],
  ['F', '사원'],
]

export function titleOf(grade: Grade): string {
  const at = EMPLOYEE_LADDER.indexOf(grade)
  for (const [from, title] of TITLES) {
    if (at >= EMPLOYEE_LADDER.indexOf(from)) {
      return title
    }
  }
  return '사원'
}
