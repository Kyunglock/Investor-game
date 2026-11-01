import type { Game, LogEntry, Outcome } from '../../api/client'
import { childWord, withParticle } from './labels'
import { childName } from './log'
import { stageFor } from './pixel/bodies'
import type { MoodKey } from './pixel/moods'
import { opposite } from './pixel/sexes'
import type { CreditArt, Figure } from './pixel/vignettes'

/**
 * 감정이 드러나는 순간 (decisions.md 62번). 결과 카드·토스트·수첩 사진이 그림과 표정을 바꾼다. 재료는 서버가 준 결과·기록·가계뿐이다.
 */
export interface Moment {
  art: CreditArt
  /** 모두의 표정. null이면 평소 얼굴(담담한 순간) */
  mood: MoodKey | null
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

/** 집들이 그림: 거실에 나(와 배우자) (decisions.md 140번). */
function housewarmingArt(game: Game): CreditArt {
  const stage = myStage(game)
  const figures: Figure[] = [{ who: 'me', sex: game.sex, stage, x: 14 }]
  if (game.household.married) {
    figures.push({ who: 'spouse', sex: opposite(game.sex), stage, x: 28 })
  }
  return { vignette: 'family', figures }
}

const HOUSEWARMING_CAPTIONS: Record<string, string> = {
  luxury: '집이 사람으로 꽉 찼다. 휴지가 베란다에 쌓였다.',
  normal: '가까운 사람들과 집밥을 나눴다.',
  cheap: '가족끼리 짜장면. 새집 냄새가 났다.',
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

type Payload = Record<string, unknown>

/** 지금 나이의 몸(어른·중년·노년). */
function myStage(game: Game) {
  return stageFor(game.startAge + Math.floor(game.day / game.daysPerYear))
}

/** 오늘(game.day) 남은 기록 가운데 그 종류의 마지막 것. */
function todays(game: Game, kind: LogEntry['kind']): LogEntry | undefined {
  return [...game.log].reverse().find((e) => e.kind === kind && e.day === game.day)
}

/** 아이가 떠나는 날의 그림: 집 앞에 나(와 배우자), 길에 어른이 된 아이 (decisions.md 139번). */
function leavingArt(game: Game, seq: number): CreditArt {
  const stage = myStage(game)
  const figures: Figure[] = [{ who: 'me', sex: game.sex, stage, x: 2 }]
  if (game.household.married) {
    figures.push({ who: 'spouse', sex: opposite(game.sex), stage, x: 16 })
  }
  figures.push({
    who: 'kid',
    sex: game.household.children?.[seq - 1]?.sex ?? 'M',
    stage: 'adult',
    x: 34,
  })
  return { vignette: 'leave-home', figures }
}

/** 아이의 결혼식: 아치 앞에 아이, 하객석 쪽에 나(와 배우자) (decisions.md 139번). */
function weddingArt(game: Game, seq: number): CreditArt {
  const stage = myStage(game)
  const figures: Figure[] = [{ who: 'me', sex: game.sex, stage, x: 4 }]
  if (game.household.married) {
    figures.push({ who: 'spouse', sex: opposite(game.sex), stage, x: 18 })
  }
  figures.push({
    who: 'kid',
    sex: game.household.children?.[seq - 1]?.sex ?? 'M',
    stage: 'adult',
    x: 40,
  })
  return { vignette: 'wedding', figures }
}

/** 실직한 날: 짐 상자가 놓인 빈 책상 앞에 혼자 (decisions.md 139번). */
function layoffArt(game: Game): CreditArt {
  return { vignette: 'layoff', figures: [{ who: 'me', sex: game.sex, stage: myStage(game), x: 4 }] }
}

/** 취직한 날: 첫 일터와 같은 사무실(전업투자자는 작업실) 그림 (decisions.md 139번). */
function hiredArt(game: Game, fullTimeInvestor: boolean): CreditArt {
  return {
    vignette: fullTimeInvestor ? 'studio' : 'office',
    figures: [{ who: 'me', sex: game.sex, stage: myStage(game), x: fullTimeInvestor ? 36 : 38 }],
  }
}

/** 불황 회고: 셔터 내린 상점가 앞에 혼자 (decisions.md 139번). */
export function recessionMoment(game: Game, entry: LogEntry): Moment {
  const p = entry.payload as Payload
  return {
    art: {
      vignette: 'recession',
      figures: [{ who: 'me', sex: game.sex, stage: myStage(game), x: 26 }],
    },
    mood: 'despair',
    caption: `${String(p.name ?? '위기')}${p.severity === 'DEPRESSION' ? '. 대공황이었다.' : '. 불황이었다.'}`,
  }
}

/** 직장 장면의 결과가 실직이었나: 직업이 사라지고 "월급이 끊기고"가 적혔다. 전업투자자 전향은 실직이 아니다. */
function laidOff(entry: LogEntry): boolean {
  const p = entry.payload as Payload
  return (
    p.jobTitle == null &&
    p.fullTimeInvestor !== true &&
    String(p.text ?? '').includes('월급이 끊기')
  )
}

/** 결과 카드에 띄울 순간. 아이가 태어났거나 가족 여행을 갔으면 기쁨, 큰 손익이면 자신감·좌절, 취직·실직은 그 날의 그림. 없으면 null. */
export function momentForOutcome(outcome: Outcome, game: Game): Moment | null {
  if (outcome.kind === 'JOB') {
    const job = todays(game, 'JOB')
    if (!job) {
      return null
    }
    const p = job.payload as Payload
    const investor = p.fullTimeInvestor === true
    return {
      art: hiredArt(game, investor),
      mood: 'confident',
      caption: investor
        ? '회사 대신 시장으로 출근한다. 월급은 없다.'
        : p.rehire === true
          ? `${withParticle(String(p.jobTitle ?? '새 직장'), '으로', '로')} 다시 출근한다. 경력을 인정받았다.`
          : `${String(p.jobTitle ?? '직장')} 첫 출근. 다음 달부터 월급이 들어온다.`,
    }
  }
  if (outcome.kind === 'CAREER') {
    const career = todays(game, 'CAREER')
    if (career && laidOff(career)) {
      return {
        art: layoffArt(game),
        mood: 'despair',
        caption: '책상을 비웠다. 내일부터는 출근하지 않는다.',
      }
    }
    return null
  }
  if (outcome.kind === 'LIFE') {
    // 가족 여행 선택 (decisions.md 71번). 안 갔으면 그림도 없다.
    const trip = [...game.log]
      .reverse()
      .find(
        (e) =>
          e.kind === 'LIFE' &&
          e.day === game.day &&
          ['family-trip', 'kid-outing', 'housewarming'].includes(
            String((e.payload as Record<string, unknown>).noticeCode),
          ),
      )
    if (trip) {
      const p = trip.payload as Record<string, unknown>
      if (Number(p.amount ?? 0) >= 0) {
        return null
      }
      if (p.noticeCode === 'housewarming') {
        return {
          art: housewarmingArt(game),
          mood: 'joy',
          caption: HOUSEWARMING_CAPTIONS[String(p.option)] ?? '새집에 사람들을 불렀다.',
        }
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

/** 토스트에 그림을 붙일 생활 기록: 실제로 다녀온 가족 여행·나들이, 아이의 독립과 결혼 (decisions.md 139번). 안 간 여행(금액 0)은 그림 없음. */
export function momentForNotice(entry: LogEntry, game: Game): Moment | null {
  const p = entry.payload as Record<string, unknown>
  if (entry.kind === 'CHILD_LEFT') {
    const seq = Number(p.seq ?? 1)
    return {
      art: leavingArt(game, seq),
      mood: null,
      caption: `${childName(seq)}가 짐을 꾸려 집을 나갔다. 방 하나가 조용해졌다.`,
    }
  }
  if (entry.kind === 'CHILD_WEDDING') {
    const seq = Number(p.seq ?? 1)
    return {
      art: weddingArt(game, seq),
      mood: 'joy',
      caption: `${childName(seq)}가 결혼했다. 식장에서 한참을 서 있었다.`,
    }
  }
  if (entry.kind === 'LIFE' && p.noticeCode === 'housewarming' && Number(p.amount ?? 0) < 0) {
    return {
      art: housewarmingArt(game),
      mood: 'joy',
      caption: HOUSEWARMING_CAPTIONS[String(p.option)] ?? '새집에 사람들을 불렀다.',
    }
  }
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
