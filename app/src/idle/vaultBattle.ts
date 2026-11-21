import { assaultSpec } from '../mental/assault'

const DAY = 86_400_000
// 1970년 1월 5일 한국 시간 월요일 자정.
const MONDAY = 4 * DAY - 9 * 3_600_000
export const WEEK = 7 * DAY
export const vaultWeek = (now: number) => Math.floor((now - MONDAY) / WEEK)
export const nextVaultWeek = (week: number) => MONDAY + (week + 1) * WEEK
export const vaults = ['자수정 금고', '월광 금고', '황혼 금고'] as const

export function vaultEncounter(boss: boolean, floor: number, week: number) {
  const name = boss ? '흑금 수호냥' : vaults[week % vaults.length]
  const spec = assaultSpec(boss ? 3 : floor, { name })
  const guardian = spec.walls[spec.walls.length - 1]
  const approach = Array.from({ length: boss ? 0 : floor }, (_, i) => spec.walls[(week + i) % 4])
  return { ...spec, walls: [...approach, guardian] }
}
