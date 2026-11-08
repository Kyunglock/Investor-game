import { create } from 'zustand'
import type { Company } from '../../api/client'

export const TUTORIAL_KEY = 'investor-game.tutorial'

/** 튜토리얼의 걸음 (decisions.md 302번): 회사 상태로 지금 몇 걸음째인지 정한다. 다 끝났으면 'grow'에서 끝내기를 누른다. */
export type TutorialStep = {
  id: 'hire' | 'place' | 'meeting' | 'sheet' | 'grow'
  /** 몇 걸음째(1~5) */
  n: number
  title: string
  text: string
  /** 이 걸음에서 열어 둘 탭. 없으면 그대로. */
  tab?: 'market' | 'staff' | 'meeting'
  /** 이 걸음에서 반짝이는 것: 탭 이름이나 분기 넘기기·이사 버튼. */
  spot?: 'market' | 'staff' | 'settle' | 'upgrade'
  /** 앱의 한 줄 안내 (347번): 말풍선 대신 짧게. */
  short: string
}

export const TUTORIAL_STEPS = 5

/** 튜토리얼이 잠갔다 여는 것들 (decisions.md 347번): 탭 넷, 분기 넘기기, 자동 진행, 건물 키우기. */
export type Feature = 'market' | 'staff' | 'settle' | 'issue' | 'record' | 'auto' | 'upgrade'

export const FEATURE_NAMES: Record<Feature, string> = {
  market: '채용',
  staff: '배치',
  settle: '분기 넘기기',
  issue: '이슈',
  record: '기록',
  auto: '자동 진행',
  upgrade: '건물 키우기',
}

const STEP_ORDER: TutorialStep['id'][] = ['hire', 'place', 'meeting', 'sheet', 'grow']

/** 걸음마다 새로 열리는 것. 앞 걸음에서 연 것은 그대로 열려 있다. */
export const UNLOCKS: Record<TutorialStep['id'], Feature[]> = {
  hire: ['market'],
  place: ['staff'],
  meeting: ['settle'],
  sheet: ['issue', 'record'],
  grow: ['upgrade', 'auto'],
}

export const ALL_FEATURES: Feature[] = STEP_ORDER.flatMap((id) => UNLOCKS[id])

/**
 * 지금 열려 있는 것 (347번): 튜토리얼이 꺼져 있으면 전부, 켜져 있으면 지금 걸음까지 연 것만. 처음 온 사람은 채용 탭만 누를 수 있고, 걸음을 하나 깰 때마다
 * 하나씩 열린다. 걸음은 회사 상태가 정하므로 다시 들어와도 그대로다.
 */
export function unlockedFeatures(company: Company, active: boolean): Feature[] {
  if (!active || company.status === 'ENDED') {
    return ALL_FEATURES
  }
  const at = STEP_ORDER.indexOf(tutorialStep(company).id)
  return STEP_ORDER.slice(0, at + 1).flatMap((id) => UNLOCKS[id])
}

/**
 * 회사 상태로 지금 걸음을 정한다: 직원이 없으면 뽑기, 앉은 사람이 없으면 앉히기, 첫 분기면 넘기기, 첫 해면 결산 읽기, 그 뒤는 키우기(끝내기).
 */
export function tutorialStep(company: Company): TutorialStep {
  if (company.employees.length === 0) {
    return {
      id: 'hire',
      n: 1,
      title: '직원 뽑기',
      text: '채용 탭에서 채용권으로 사람을 뽑습니다. 카드가 뒤집히며 등급이 드러납니다. 방패의 등급이 높을수록 잘 맞히고, 같은 등급 둘을 모아 카드를 끌어 겹치면 한 단계 올릴 수 있습니다.',
      tab: 'market',
      spot: 'market',
      short: '채용 탭에서 직원을 뽑자',
    }
  }
  if (!company.employees.some((e) => e.desk)) {
    return {
      id: 'place',
      n: 2,
      title: '자리에 앉히기',
      text: '배치 탭에서 자리를 누르고 직원을 앉힙니다. 처음엔 돈을 굴리는 섹터 데스크·단타만 열려 있습니다. 리서치 팀(형광펜)·종목 발굴팀·리스크 관리 팀·인사팀은 회사가 커지면 하나씩 열립니다. 사무실 그림의 칸을 눌러도 되고, "자동 배치"도 됩니다.',
      tab: 'staff',
      spot: 'staff',
      short: '배치 탭에서 자리에 앉히자',
    }
  }
  if (!company.lastQuarter && !company.lastSettlement) {
    return {
      id: 'meeting',
      n: 3,
      title: '분기 넘기기',
      text: '아래 "분기 넘기기"를 누르면 직원이 종목을 물어 옵니다. 물어 왔으면 종목 회의가 열립니다. 직원 의견을 듣고 사장이 정하거나 직원들에게 맡깁니다.',
      spot: 'settle',
      short: '아래 분기 넘기기로 회의와 멘탈 전투를',
    }
  }
  if (!company.lastSettlement) {
    return {
      id: 'sheet',
      n: 4,
      title: '결산 읽기',
      text: '분기 실적과 팀장 보고를 읽습니다. 네 분기를 넘기면 연말 결산서가 뜹니다. 이슈 탭에는 폭락 조짐이 올라옵니다.',
      tab: 'meeting',
      spot: 'settle',
      short: '이슈·기록 탭이 열렸다. 분기를 더 넘겨 연말 결산까지',
    }
  }
  return {
    id: 'grow',
    n: 5,
    title: '회사 키우기',
    text: '자본이 모이면 위의 버튼이 반짝입니다. 눌러서 사무실을 넓히거나 새 건물을 지으세요(건물은 몇 해 걸립니다). 자리가 늘고, 뽑기 등급이 오르고, 새 자리가 열립니다. 급하면 "⟳ 자동 진행"이 공채·배치·회의·결산을 대신합니다. 랜드마크 타워에 올라도 끝이 아닙니다!',
    spot: 'upgrade',
    short: '건물 키우기와 자동 진행이 열렸다. 랜드마크 타워까지!',
  }
}

/** 브라우저에 남긴 튜토리얼 상태: on(보는 중)·done(끝냈다). 없으면 아직 고르지 않았다. */
function stored(): 'on' | 'done' | null {
  try {
    const v = localStorage.getItem(TUTORIAL_KEY)
    return v === 'on' || v === 'done' ? v : null
  } catch {
    return null
  }
}

function store(v: 'on' | 'done') {
  try {
    localStorage.setItem(TUTORIAL_KEY, v)
  } catch {
    // 저장이 안 되면 이번 화면에서만 남는다.
  }
}

/**
 * 튜토리얼 (decisions.md 302번). 시작 화면에서 "튜토리얼과 함께 시작"을 고르면 켜지고, 회사 화면 위에 지금 걸음이 띠로 보인다. 건너뛰거나 끝내면 브라우저에
 * 남아 다시 보이지 않는다. 한 번도 고르지 않았으면 시작 화면이 튜토리얼 쪽을 먼저 권한다.
 */
export const useTutorial = create<{
  active: boolean
  /** 아직 한 번도 튜토리얼을 고르거나 끝내지 않았다: 처음 온 사람. */
  fresh: boolean
  start: () => void
  finish: () => void
}>((set) => ({
  active: stored() === 'on',
  fresh: stored() === null,
  start: () => {
    store('on')
    set({ active: true, fresh: false })
  },
  finish: () => {
    store('done')
    set({ active: false, fresh: false })
  },
}))
