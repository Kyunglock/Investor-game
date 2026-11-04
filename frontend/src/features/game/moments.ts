import type { Game, LogEntry, Outcome } from '../../api/client'
import { childWord, withParticle } from './labels'
import { childName } from './log'
import { stageFor } from './pixel/bodies'
import { carryBabies, fromBehind, lineUp, type Member } from './pixel/family'
import type { MoodKey } from './pixel/moods'
import { opposite } from './pixel/sexes'
import type { CreditArt, Figure, VignetteKey } from './pixel/vignettes'

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

/** 가족 여행 그림: 바다에 나와 배우자, 집에 있는 아이들(독립한 아이는 빼고)을 지금 나이의 몸으로. 아기는 업힌다 (decisions.md 163·178번). */
function tripArt(game: Game): CreditArt {
  const stage = myStage(game)
  const people: Member[] = [
    { who: 'me', sex: game.sex, stage },
    { who: 'spouse', sex: opposite(game.sex), stage },
  ]
  ;(game.household?.children ?? []).forEach((kid, i) => {
    if (!kid.leftHome) {
      people.push({ who: 'kid', sex: kid.sex, stage: stageFor(kid.age), look: i })
    }
  })
  // 왼쪽부터 닿지 않게 세우고, 넘치는 사람은 그리지 않는다. 온 가족이 바다를 바라보는 뒷모습 (decisions.md 194번).
  return { vignette: 'trip', figures: fromBehind(lineUp(carryBabies(people))) }
}

/** 집들이 그림: 거실에 나(와 배우자). 손님을 맞으며 손을 흔든다 (decisions.md 140·192번). */
function housewarmingArt(game: Game): CreditArt {
  const stage = myStage(game)
  const figures: Figure[] = [{ who: 'me', sex: game.sex, stage, x: 14, pose: 'wave' }]
  if (game.household.married) {
    figures.push({ who: 'spouse', sex: opposite(game.sex), stage, x: 28, pose: 'clap' })
  }
  return { vignette: 'family', figures }
}

/** 집을 산 날: 새집 앞에서 온 가족 손뼉, 아기는 업은 채 (decisions.md 192번). */
function newHomeArt(game: Game): CreditArt {
  const stage = myStage(game)
  const people: Member[] = [{ who: 'me', sex: game.sex, stage }]
  if (game.household.married) {
    people.push({ who: 'spouse', sex: opposite(game.sex), stage })
  }
  ;(game.household?.children ?? []).forEach((kid, i) => {
    if (!kid.leftHome) {
      people.push({ who: 'kid', sex: kid.sex, stage: stageFor(kid.age), look: i })
    }
  })
  // 새집을 올려다보는 뒷모습 (decisions.md 194번).
  return { vignette: 'new-home', figures: fromBehind(lineUp(carryBabies(people))) }
}

/** 결혼한 날: 꽃 아치 앞에서 둘이 마주 본다 (decisions.md 192·194번). */
function marriageArt(game: Game): CreditArt {
  const stage = myStage(game)
  return {
    vignette: 'wedding',
    figures: [
      { who: 'me', sex: game.sex, stage, x: 16, view: 'side', facing: 'right' },
      { who: 'spouse', sex: opposite(game.sex), stage, x: 28, view: 'side', facing: 'left' },
    ],
  }
}

/**
 * 아이가 태어난 날: 배우자가 아기를 안고 내가 곁에서 어깨를 감싼다. 혼자면 내가 안는다. 먼저 난 아이들은 옆에서 손뼉 (decisions.md 192번).
 */
function birthArt(game: Game, baby: { sex: Game['sex']; look: number }): CreditArt {
  const stage = myStage(game)
  const holding = { sex: baby.sex, look: baby.look }
  const figures: Figure[] = game.household.married
    ? [
        // 아기를 안은 배우자 쪽으로 돌아선 옆모습 (decisions.md 194번).
        { who: 'me', sex: game.sex, stage, x: 12, view: 'side', facing: 'right' },
        { who: 'spouse', sex: opposite(game.sex), stage, x: 24, pose: 'hold', holding },
      ]
    : [{ who: 'me', sex: game.sex, stage, x: 22, pose: 'hold', holding }]
  const older = (game.household?.children ?? []).findIndex((k, i) => i < baby.look && !k.leftHome)
  if (older >= 0 && game.household.married) {
    const kid = game.household.children[older]
    const kidStage = stageFor(kid.age)
    if (kidStage !== 'baby') {
      figures.unshift({
        who: 'kid',
        sex: kid.sex,
        stage: kidStage,
        x: 0,
        look: older,
        view: 'side',
        facing: 'right',
      })
    }
  }
  return { vignette: 'baby', figures }
}

const HOUSEWARMING_CAPTIONS: Record<string, string> = {
  luxury: '집이 사람으로 꽉 찼다. 휴지가 베란다에 쌓였다.',
  normal: '가까운 사람들과 집밥을 나눴다.',
  cheap: '가족끼리 짜장면. 새집 냄새가 났다.',
}

/**
 * 아이의 나들이·행사마다 다른 그림 (decisions.md 87·192번). 배우자는 집에서 쉬는 날이고 나와 그 아이만 나온다.
 * 아이가 아직 아기면 내가 안고 간다. 무대에 선 아이는 무대 높이만큼 띄운다.
 */
const OUTING_SCENES: Record<
  string,
  {
    vignette: VignetteKey
    me: Omit<Figure, 'who' | 'sex' | 'stage'>
    kid: Omit<Figure, 'who' | 'sex' | 'stage'>
  }
> = {
  // 손잡고 걷는다: 둘 다 오른쪽으로 걷는 옆모습 (decisions.md 194번).
  park: {
    vignette: 'park',
    me: { x: 12, view: 'walk', facing: 'right' },
    kid: { x: 24, view: 'walk', facing: 'right' },
  },
  // 울타리 너머 기린을 바라보는 뒷모습.
  zoo: { vignette: 'zoo', me: { x: 10, view: 'back' }, kid: { x: 24, view: 'back' } },
  // 모닥불을 바라보는 옆모습.
  camp: {
    vignette: 'camp',
    me: { x: 0, view: 'side', facing: 'right' },
    kid: { x: 12, view: 'side', facing: 'right' },
  },
  // 아이는 달리고, 나는 손뼉.
  'sports-day': {
    vignette: 'sports',
    me: { x: 2, pose: 'clap' },
    kid: { x: 26, view: 'walk', facing: 'right' },
  },
  // 객석의 뒷모습, 무대 위 아이.
  'school-play': { vignette: 'stage', me: { x: 4, view: 'back' }, kid: { x: 25, lift: 3 } },
  // 칠판을 보는 아이의 뒷모습, 뒤에서 지켜보는 나.
  'open-class': {
    vignette: 'classroom',
    me: { x: 44, pose: 'clap' },
    kid: { x: 18, view: 'back' },
  },
  // 케이크 앞 아이를 향해 손뼉.
  birthday: {
    vignette: 'birthday',
    me: { x: 42, view: 'side', facing: 'left' },
    kid: { x: 8, pose: 'clap' },
  },
  // 객석의 뒷모습, 피아노를 향한 아이.
  recital: {
    vignette: 'recital',
    me: { x: 2, view: 'back' },
    kid: { x: 24, lift: 3, view: 'side', facing: 'right' },
  },
  // 학교 앞에서 마주 본다.
  graduation: {
    vignette: 'graduation',
    me: { x: 4, view: 'side', facing: 'right' },
    kid: { x: 17, view: 'side', facing: 'left' },
  },
}

function outingArt(game: Game, outing?: unknown): CreditArt {
  const look = Math.max(
    0,
    game.household.children.findIndex((c) => !c.leftHome),
  )
  const kid = game.household.children[look]
  const scene = OUTING_SCENES[String(outing ?? 'park')] ?? OUTING_SCENES.park
  const kidStage = kid ? stageFor(kid.age) : 'child'
  const stage = myStage(game)
  if (kidStage === 'baby') {
    return {
      vignette: scene.vignette,
      figures: [
        {
          who: 'me',
          sex: game.sex,
          stage,
          ...scene.me,
          pose: 'hold',
          holding: { sex: kid?.sex ?? 'M', look },
        },
      ],
    }
  }
  return {
    vignette: scene.vignette,
    figures: [
      { who: 'me', sex: game.sex, stage, ...scene.me },
      { who: 'kid', sex: kid?.sex ?? 'M', stage: kidStage, look, ...scene.kid },
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
    look: seq - 1,
    // 짐을 들고 길을 걸어 떠난다 (decisions.md 194번).
    view: 'walk',
    facing: 'right',
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
    look: seq - 1,
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
          art: outingArt(game, p.outing),
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
        art: birthArt(game, {
          sex: (p.sex as Game['sex']) ?? game.household.children[seq - 1]?.sex ?? 'M',
          look: seq - 1,
        }),
        mood: 'joy',
        caption: `${childName(seq)} ${withParticle(childWord(p.sex), '이', '가')} 태어났다. 세상이 달라 보인다.`,
      }
    }
    if (todays(game, 'MARRIAGE')) {
      return { art: marriageArt(game), mood: 'joy', caption: '결혼했다. 손을 꼭 잡았다.' }
    }
    return null
  }
  if (outcome.kind === 'HOUSING') {
    // 집을 산 날 (decisions.md 192번): 매수·청약 당첨·배우자 말에 산 집. 세입자를 둔 갭투자는 내가 살 집이 아니라 그림이 없다.
    const housing = todays(game, 'HOUSING')
    const p = (housing?.payload ?? {}) as Payload
    const bought =
      housing &&
      p.option !== 'GAP' &&
      (p.option === 'APPLY' ? p.bought === true : Number(p.price ?? 0) > 0)
    if (!bought) {
      return null
    }
    return {
      art: newHomeArt(game),
      mood: 'joy',
      caption: `${String(p.regionName ?? '')} 아파트. 우리 집이 생겼다.`.trim(),
    }
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
        art: {
          vignette: 'surge',
          figures: [{ who: 'me', sex: game.sex, stage: 'adult', x: 36, pose: 'clap' }],
        },
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
      art: outingArt(game, p.outing),
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
