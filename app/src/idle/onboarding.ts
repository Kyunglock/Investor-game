import type { Company } from '@web/api/client'

export const ONBOARDING = [
  ['첫 매도벽 돌파', '사장냥은 자동으로 공격해요. 첫 매도벽이 부서지는 걸 지켜봐요.'],
  ['첫 공격력 강화', '성장 메뉴에서 공격력을 한 번 강화해 주세요. 더 빠르게 돌파할 수 있어요.'],
  ['첫 동료 선물', '메테오 마법을 가진 A등급 밤냥을 선물할게요!'],
  ['밤냥 출전', '고양이·무기에서 밤냥을 고르고 출전 버튼을 눌러 주세요.'],
  ['첫 무기 선물', '밤냥에게 줄 B등급 기관단총을 받아 주세요.'],
  ['기관단총 장착', '밤냥의 무기 목록에서 B등급 기관단총을 고르고 장착해 주세요.'],
  ['자동 메테오', '출전한 밤냥은 메테오를 자동으로 써요. 전투에서 함께 싸우는 모습을 확인해 봐요.'],
  ['첫 팀 완성!', '이제 자유롭게 돌파해 보세요. 직접 사용하는 스킬은 100 매도벽 돌파 후 열려요.'],
] as const

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
