import type { Game, LogEntry, Outcome } from '../../api/client'
import type { MoodKey } from './pixel/moods'
import type { CreditArt } from './pixel/vignettes'

/**
 * 감정이 드러나는 순간 (decisions.md 62번). 결과 카드·토스트·수첩 사진이 그림과 표정을 바꾼다. 재료는 서버가 준 결과·기록·가계뿐이다.
 */
export interface Moment {
  art: CreditArt
  mood: MoodKey
  caption: string
}

/** 손익이 총자산의 이 비율(만분율)을 넘으면 급등·급락으로 본다. */
export const BIG_MOVE_BP = 500
const BP = 10_000

/** 결과 카드에 띄울 순간. 아이가 태어났으면 기쁨, 큰 손익이면 자신감·좌절. 없으면 null. */
export function momentForOutcome(outcome: Outcome, game: Game): Moment | null {
  if (outcome.kind === 'LIFE') {
    const child = [...game.log].reverse().find((e) => e.kind === 'CHILD' && e.day === game.day)
    if (child) {
      const seq = Number((child.payload as Record<string, unknown>).seq ?? 1)
      return {
        art: {
          vignette: 'baby',
          figures: [
            { who: 'me', stage: 'adult', x: 20 },
            ...(game.household.married ? [{ who: 'spouse', stage: 'adult', x: 4 } as const] : []),
          ],
        },
        mood: 'joy',
        caption: `${seq}번째 아이가 태어났다. 세상이 달라 보인다.`,
      }
    }
    return null
  }
  const pnl = outcome.price?.pnl ?? 0
  if (pnl === 0 || game.totalAsset <= 0) {
    return null
  }
  const ratioBp = Math.round((Math.abs(pnl) * BP) / game.totalAsset)
  if (ratioBp < BIG_MOVE_BP) {
    return null
  }
  return pnl > 0
    ? {
        art: { vignette: 'surge', figures: [{ who: 'me', stage: 'adult', x: 36 }] },
        mood: 'confident',
        caption: '시세판이 온통 빨갛다. 내가 맞았다.',
      }
    : {
        art: { vignette: 'crash', figures: [{ who: 'me', stage: 'adult', x: 36 }] },
        mood: 'despair',
        caption: '파란 숫자를 한참 바라봤다.',
      }
}

/** 토스트에 그림을 붙일 생활 알림: 가족 여행. */
export function momentForNotice(entry: LogEntry): Moment | null {
  const p = entry.payload as Record<string, unknown>
  if (entry.kind === 'LIFE' && (p.noticeCode === 'family-trip' || p.title === '가족 여행')) {
    return {
      art: {
        vignette: 'trip',
        figures: [
          { who: 'me', stage: 'adult', x: 14 },
          { who: 'spouse', stage: 'adult', x: 26 },
        ],
      },
      mood: 'joy',
      caption: '가족 여행을 다녀왔다.',
    }
  }
  return null
}

/** 수첩 사진: 현금이 한 달 생활비에 못 미치거나 빚이 있으면 긴축 생활 (독립한 뒤에만). */
export function frugalMoment(game: Game): Moment | null {
  const expense = game.household.monthlyExpense
  if (expense <= 0) {
    return null
  }
  if (game.debt > 0 || game.cash < expense) {
    return {
      art: { vignette: 'frugal', figures: [{ who: 'me', stage: 'adult', x: 34 }] },
      mood: 'frugal',
      caption: game.debt > 0 ? '빚을 갚느라 생활비를 아끼는 중' : '생활비를 아끼는 중',
    }
  }
  return null
}
