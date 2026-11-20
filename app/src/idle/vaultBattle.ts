const DAY = 86_400_000
// 1970년 1월 5일 한국 시간 월요일 자정.
const MONDAY = 4 * DAY - 9 * 3_600_000
export const WEEK = 7 * DAY
export const vaultWeek = (now: number) => Math.floor((now - MONDAY) / WEEK)
export const nextVaultWeek = (week: number) => MONDAY + (week + 1) * WEEK
export const vaults = ['자수정 금고', '월광 금고', '황혼 금고'] as const

export type Fight = {
  hp: number
  enemy: number
  maxEnemy: number
  round: number
  pattern: number
  charged: boolean
  log: string
}

export function enterVault(hp: number, pattern: number): Fight {
  return {
    hp: 36,
    enemy: hp,
    maxEnemy: hp,
    round: 1,
    pattern,
    charged: false,
    log: '적의 다음 행동을 살펴보세요.',
  }
}

export const heavyStrike = (fight: Fight) => (fight.round + fight.pattern) % 3 === 0

export function playTurn(fight: Fight, guard: boolean): Fight {
  if (fight.hp <= 0 || fight.enemy <= 0) return fight
  const heavy = heavyStrike(fight)
  const damage = guard ? 0 : fight.charged ? 21 : 10
  const enemy = Math.max(0, fight.enemy - damage)
  const hit = !enemy || guard ? 0 : heavy ? 21 : 5
  const log = guard
    ? heavy
      ? '강타를 막았다! 다음 공격은 21 피해.'
      : '공격을 막았다.'
    : `${damage} 피해! ${hit ? `반격으로 체력 ${hit} 감소.` : '적을 쓰러뜨렸다.'}`
  return {
    ...fight,
    enemy,
    hp: Math.max(0, fight.hp - hit),
    round: fight.round + 1,
    charged: guard && (heavy || fight.charged),
    log,
  }
}
