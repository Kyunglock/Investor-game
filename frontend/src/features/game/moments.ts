import type { Game, LogEntry, Outcome } from '../../api/client'
import { childWord, withParticle } from './labels'
import { childName } from './log'
import type { MoodKey } from './pixel/moods'
import { opposite } from './pixel/sexes'
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

/** 가족 여행 그림: 바다에 나와 배우자. */
function tripArt(game: Game): CreditArt {
  return {
    vignette: 'trip',
    figures: [
      { who: 'me', sex: game.sex, stage: 'adult', x: 14 },
      { who: 'spouse', sex: opposite(game.sex), stage: 'adult', x: 26 },
    ],
  }
}

/** 아이의 나들이 그림: 놀이동산에 나와 아이 (decisions.md 87번). 배우자는 집에서 쉬는 날이다. */
function outingArt(game: Game): CreditArt {
  const kid = game.household.children.find((c) => !c.leftHome)
  return {
    vignette: 'park',
    figures: [
      { who: 'me', sex: game.sex, stage: 'adult', x: 14 },
      { who: 'kid', sex: kid?.sex ?? 'M', stage: 'child', x: 28 },
    ],
  }
}

const OUTING_CAPTIONS: Record<string, string> = {
  luxury: '아이가 온종일 웃었다. 통장은 가벼워졌다.',
  normal: '아이와 하루를 보냈다.',
  cheap: '작게 놀아도 아이는 좋아했다.',
}

const TRIP_CAPTIONS: Record<string, string> = {
  luxury: '호화롭게 다녀왔다. 통장은 가벼워졌지만 후회는 없다.',
  normal: '가족 여행을 다녀왔다.',
  cheap: '가까운 데라도 다녀오니 좋았다.',
}

/** 결과 카드에 띄울 순간. 아이가 태어났거나 가족 여행을 갔으면 기쁨, 큰 손익이면 자신감·좌절. 없으면 null. */
export function momentForOutcome(outcome: Outcome, game: Game): Moment | null {
  if (outcome.kind === 'LIFE') {
    // 가족 여행 선택 (decisions.md 71번). 안 갔으면 그림도 없다.
    const trip = [...game.log]
      .reverse()
      .find(
        (e) =>
          e.kind === 'LIFE' &&
          e.day === game.day &&
          ['family-trip', 'kid-outing'].includes(
            String((e.payload as Record<string, unknown>).noticeCode),
          ),
      )
    if (trip) {
      const p = trip.payload as Record<string, unknown>
      if (Number(p.amount ?? 0) >= 0) {
        return null
      }
      if (p.noticeCode === 'kid-outing') {
        return {
          art: outingArt(game),
          mood: 'joy',
          caption: OUTING_CAPTIONS[String(p.option)] ?? '아이와 하루를 보냈다.',
        }
      }
      return {
        art: tripArt(game),
        mood: 'joy',
        caption: TRIP_CAPTIONS[String(p.option)] ?? '가족 여행을 다녀왔다.',
      }
    }
    const child = [...game.log].reverse().find((e) => e.kind === 'CHILD' && e.day === game.day)
    if (child) {
      const p = child.payload as Record<string, unknown>
      const seq = Number(p.seq ?? 1)
      return {
        art: {
          vignette: 'baby',
          figures: [
            { who: 'me', sex: game.sex, stage: 'adult', x: 20 },
            ...(game.household.married
              ? [{ who: 'spouse', sex: opposite(game.sex), stage: 'adult', x: 4 } as const]
              : []),
          ],
        },
        mood: 'joy',
        caption: `${childName(seq)} ${withParticle(childWord(p.sex), '이', '가')} 태어났다. 세상이 달라 보인다.`,
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
        art: { vignette: 'surge', figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 36 }] },
        mood: 'confident',
        caption: '시세판이 온통 빨갛다. 내가 맞았다.',
      }
    : {
        art: { vignette: 'crash', figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 36 }] },
        mood: 'despair',
        caption: '파란 숫자를 한참 바라봤다.',
      }
}

/** 토스트에 그림을 붙일 생활 기록: 실제로 다녀온 가족 여행. 안 갔으면(금액 0) 그림 없음. */
export function momentForNotice(entry: LogEntry, game: Game): Moment | null {
  const p = entry.payload as Record<string, unknown>
  if (entry.kind === 'LIFE' && p.noticeCode === 'kid-outing' && Number(p.amount ?? 0) < 0) {
    return {
      art: outingArt(game),
      mood: 'joy',
      caption: OUTING_CAPTIONS[String(p.option)] ?? '아이와 하루를 보냈다.',
    }
  }
  if (
    entry.kind === 'LIFE' &&
    (p.noticeCode === 'family-trip' || p.title === '가족 여행') &&
    Number(p.amount ?? 0) < 0
  ) {
    return {
      art: tripArt(game),
      mood: 'joy',
      caption: TRIP_CAPTIONS[String(p.option)] ?? '가족 여행을 다녀왔다.',
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
      art: { vignette: 'frugal', figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 34 }] },
      mood: 'frugal',
      caption: game.debt > 0 ? '빚을 갚느라 생활비를 아끼는 중' : '생활비를 아끼는 중',
    }
  }
  return null
}
