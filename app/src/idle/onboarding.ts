import type { Company } from '@web/api/client'

export function tutorialReady(c: Company, step: number): boolean {
  switch (step) {
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
  // 스킬 탭은 잠그지 않는다: 첫 출근 안내 중에도 처음부터 바로 쓸 수 있다.
  if (menu === 'growth') return progress.step < 1
  if (menu === 'cats') return progress.step < 3
  return false
}
