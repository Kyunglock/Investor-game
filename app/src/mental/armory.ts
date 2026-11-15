import type { Company } from '@web/api/client'
import { GUN_GRADES } from '@web/features/game/cat/draw'
import type { CatCode } from '@web/features/raising/store'
import { DEFAULT_WEAPON, type Weapon } from './hero'

/** 10연차 (517·526번): 서버에 보내는 수. 값은 diamonds.tenDraw이고 diamonds.tenCount개가 나온다. */
export const TEN = 10

/** 합칠 수 있는 등급: 가장 높은 등급(LR)은 못 합친다 (366번). */
export type MergeGrade = Exclude<Weapon['grade'], 'LR'>

/** 무기 등급 배지 색 (346번). */
export const GRADE_BADGE: Record<Weapon['grade'], string> = {
  F: 'bg-slate-200 text-slate-700',
  E: 'bg-emerald-100 text-emerald-800',
  D: 'bg-sky-100 text-sky-800',
  C: 'bg-violet-100 text-violet-800',
  B: 'bg-fuchsia-100 text-fuchsia-800',
  A: 'bg-orange-100 text-orange-800',
  S: 'bg-cyan-100 text-cyan-900',
  SS: 'bg-blue-100 text-blue-900',
  SSS: 'bg-purple-100 text-purple-900',
  SR: 'bg-rose-100 text-rose-900',
  UR: 'bg-lime-100 text-lime-900',
  LR: 'bg-yellow-100 text-yellow-900',
}

/** 무기 뽑기 배지: 가진 다이아로 뽑을 수 있는 횟수 (526번). 한 번도 못 뽑으면 달지 않는다. */
export function drawBadge(company: Company): string | null {
  const d = company.diamonds
  if (!company.armory || d.draw <= 0) return null
  const draws = Math.floor(d.amount / d.draw)
  return draws > 0 ? (draws > 99 ? '99+' : String(draws)) : null
}

/** 무기를 든 이: code가 null이면 사장냥이다. */
export interface Holder {
  code: CatCode | null
  name: string
}

export const BOSS_NAME = '사장냥'

/** 가진 무기. 무기 전에 차린 회사라 목록이 비어 있으면 사장냥이 든 일반 권총 하나다. */
export function weaponsOf(company: Company): Weapon[] {
  const weapons = company.weapons?.length ? company.weapons : [DEFAULT_WEAPON]
  return [...weapons].sort(
    (a, b) =>
      GUN_GRADES.indexOf(b.grade) - GUN_GRADES.indexOf(a.grade) || a.kind.localeCompare(b.kind),
  )
}

/** 이 무기를 든 이들 (530번): 사장냥이 먼저, 그다음 고양이. 한 명이 한 개씩 든다. */
export function holdersOf(company: Company, w: Pick<Weapon, 'kind' | 'grade' | 'equipped'>) {
  const holders: Holder[] = w.equipped ? [{ code: null, name: BOSS_NAME }] : []
  for (const cat of company.idle?.cats ?? []) {
    if (cat.weapon?.kind === w.kind && cat.weapon.grade === w.grade)
      holders.push({ code: cat.code, name: cat.name })
  }
  return holders
}

/** 아무도 들지 않은 수 (530번). 서버(IdleEngine.free)와 같다. */
export function freeCopies(company: Company, w: Weapon): number {
  return Math.max(0, w.count - holdersOf(company, w).length)
}

/** 한 등급 위. 가장 높은 등급이면 null. */
export function nextGrade(grade: Weapon['grade']): Weapon['grade'] | null {
  return GUN_GRADES[GUN_GRADES.indexOf(grade) + 1] ?? null
}

/** 합칠 수 없는 까닭. 합칠 수 있으면 null (366·530번): 아무도 들지 않은 것이 mergeCount개 있어야 한다. */
export function mergeBlock(company: Company, w: Weapon): 'top' | 'short' | null {
  const need = company.armory?.mergeCount
  if (!nextGrade(w.grade)) return 'top'
  if (!need || freeCopies(company, w) < need) return 'short'
  return null
}

/** 합칠 수 있는 무기들. */
export function mergeable(company: Company): Weapon[] {
  if (!company.armory) return []
  return weaponsOf(company).filter((w) => mergeBlock(company, w) === null)
}

/**
 * 장비 목록의 한 칸 (530번): 누가 든 것은 한 칸에 하나씩, 아무도 들지 않은 것은 합칠 수(mergeCount)만큼까지 칸을 나눠 보이고 나머지는 마지막
 * 칸의 수(stack)에 묶는다. 그래야 같은 무기를 끌어 같은 무기 위에 놓을 수 있다.
 */
export interface GearCell {
  key: string
  weapon: Weapon
  /** 든 이. 없으면 아무도 들지 않은 것이다. */
  holder: Holder | null
  /** 이 칸이 뜻하는 개수. */
  stack: number
}

export function gearCells(company: Company): GearCell[] {
  const split = Math.max(2, company.armory?.mergeCount ?? 2)
  return weaponsOf(company).flatMap((weapon) => {
    const id = `${weapon.kind}-${weapon.grade}`
    const held: GearCell[] = holdersOf(company, weapon).map((holder) => ({
      key: `${id}-${holder.code ?? 'boss'}`,
      weapon,
      holder,
      stack: 1,
    }))
    const free = freeCopies(company, weapon)
    const shown = Math.min(free, split)
    const spare: GearCell[] = Array.from({ length: shown }, (_, i) => ({
      key: `${id}-${i}`,
      weapon,
      holder: null,
      stack: i === shown - 1 ? free - shown + 1 : 1,
    }))
    return [...held, ...spare]
  })
}
