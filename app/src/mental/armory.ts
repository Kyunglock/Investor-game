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
 * 장비 목록의 한 칸 (530번, #918): 누가 든 것은 한 칸에 하나씩이다. 아무도 들지 않은 것은 한 칸에 수(stack)로 묶는다. 합칠 수 있을 때만 두
 * 칸(한 자루, 나머지)으로 나눈다: 같은 무기를 끌어 같은 무기 위에 놓으려면 칸이 둘이어야 한다. 화면은 그 두 칸을 한 상자로 붙여 그린다.
 */
export interface GearCell {
  key: string
  weapon: Weapon
  /** 든 이. 없으면 아무도 들지 않은 것이다. */
  holder: Holder | null
  /** 이 칸이 뜻하는 개수. */
  stack: number
  /** 합칠 수 있어 둘로 나눈 칸의 앞·뒤. 나누지 않았으면 없다. */
  pair?: 'first' | 'last'
}

export function gearCells(company: Company): GearCell[] {
  return weaponsOf(company).flatMap((weapon) => {
    const id = `${weapon.kind}-${weapon.grade}`
    const held: GearCell[] = holdersOf(company, weapon).map((holder) => ({
      key: `${id}-${holder.code ?? 'boss'}`,
      weapon,
      holder,
      stack: 1,
    }))
    const free = freeCopies(company, weapon)
    const spare: GearCell[] =
      free > 1 && mergeBlock(company, weapon) === null
        ? [
            { key: `${id}-0`, weapon, holder: null, stack: 1, pair: 'first' },
            { key: `${id}-1`, weapon, holder: null, stack: free - 1, pair: 'last' },
          ]
        : free > 0
          ? [{ key: `${id}-0`, weapon, holder: null, stack: free }]
          : []
    return [...held, ...spare]
  })
}

export interface MergeChange {
  weapon: Weapon
  count: number
}

/**
 * 일괄 합성의 결과 (649번): 합치기 전과 뒤의 가진 수를 견주어, 줄어든 무기(쓴 것)와 늘어난 무기(얻은 것)를 높은 등급부터. 합성은 낮은 등급부터
 * 이어지므로(F 둘이 E가 되면 그 E가 원래 있던 E와 또 합쳐진다) 중간에 생겼다 다시 쓰인 무기는 보이지 않고, 처음 가진 것과 마지막에 남은 것의 차이만 보인다.
 */
export function mergeResult(before: Company, after: Company) {
  const key = (w: Pick<Weapon, 'kind' | 'grade'>) => `${w.kind}-${w.grade}`
  const counts = new Map<string, { weapon: Weapon; before: number; after: number }>()
  for (const w of before.weapons ?? []) counts.set(key(w), { weapon: w, before: w.count, after: 0 })
  for (const w of after.weapons ?? []) {
    const seen = counts.get(key(w))
    if (seen) seen.after = w.count
    else counts.set(key(w), { weapon: w, before: 0, after: w.count })
  }
  const rows = [...counts.values()].sort(
    (a, b) => GUN_GRADES.indexOf(b.weapon.grade) - GUN_GRADES.indexOf(a.weapon.grade),
  )
  return {
    used: rows
      .filter((r) => r.before > r.after)
      .map((r) => ({ weapon: r.weapon, count: r.before - r.after })),
    made: rows
      .filter((r) => r.after > r.before)
      .map((r) => ({ weapon: r.weapon, count: r.after - r.before })),
  }
}

/** 일괄 합성의 결과 글: "쓴 무기: 권총 E ×1 · 권총 F ×2 → 얻은 무기: 리볼버 D ×1". 바뀐 것이 없으면 null. */
export function mergeResultText(result: { used: MergeChange[]; made: MergeChange[] }) {
  if (result.used.length === 0 && result.made.length === 0) return null
  const list = (items: MergeChange[]) =>
    items.map((c) => `${c.weapon.name} ${c.weapon.gradeName} ×${c.count}`).join(' · ')
  return `쓴 무기: ${list(result.used)} → 얻은 무기: ${list(result.made)}`
}
