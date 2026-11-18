import type { Company } from '@web/api/client'

export function tutorialReady(c: Company, step: number): boolean {
  switch (step) {
    case 0:
      return (c.idle?.wall ?? 1) > 1 || (c.idle?.cleared ?? 0) > 0
    case 1:
      return (c.battleUpgrades?.find((u) => u.kind === 'damage')?.level ?? 0) > 0
    case 3:
      return c.idle?.cats.some((cat) => cat.code === 'night' && cat.fielded) ?? false
    case 5:
      return (
        c.idle?.cats.some(
          (cat) => cat.code === 'night' && cat.weapon?.kind === 'smg' && cat.weapon?.grade === 'B',
        ) ?? false
      )
    default:
      return true
  }
}

export function tutorialMenuLocked(c: Company, menu: string): boolean {
  const progress = c.idle?.onboarding
  if (!progress) return false
  if (menu === 'skills') return !progress.skillsUnlocked
  if (menu === 'growth') return progress.step < 1
  if (menu === 'cats') return progress.step < 3
  return false
}
