import { create } from 'zustand'
import type { Company } from '../../api/client'

export const TUTORIAL_KEY = 'investor-game.tutorial'

/**
 * 튜토리얼의 걸음 (decisions.md 302번, #803): 회사 상태로 지금 몇 걸음째인지 정한다. 다 끝났으면 'grow'에서 끝내기를 누른다. 뽑은 직원은 서버가
 * 바로 자리에 앉히므로 앉히는 걸음은 없다 (#801).
 */
export type TutorialStep = {
  id: 'hire' | 'meeting' | 'grow'
  /** 몇 걸음째(1~3) */
  n: number
  title: string
  text: string
  /** 이 걸음에서 열어 둘 탭. 없으면 그대로. */
  tab?: 'market' | 'meeting'
  /** 이 걸음에서 반짝이는 것: 탭 이름이나 종목회의('settle')·이사 버튼. */
  spot?: 'market' | 'settle' | 'upgrade'
  /** 앱의 한 줄 안내 (347번): 말풍선 대신 짧게. */
  short: string
}

export const TUTORIAL_STEPS = 3

/**
 * 튜토리얼이 잠갔다 여는 것들 (decisions.md 347번): 탭 셋, 종목회의, 건물 키우기. 'settle'은 분기 넘기기 때의 이름이 남은 것으로, 지금은 종목회의를
 * 가리킨다 (#803).
 */
export type Feature = 'market' | 'settle' | 'issue' | 'upgrade'

export const FEATURE_NAMES: Record<Feature, string> = {
  market: '채용',
  settle: '종목회의',
  issue: '이슈',
  upgrade: '건물 키우기',
}

const STEP_ORDER: TutorialStep['id'][] = ['hire', 'meeting', 'grow']

/** 걸음마다 새로 열리는 것. 앞 걸음에서 연 것은 그대로 열려 있다. */
export const UNLOCKS: Record<TutorialStep['id'], Feature[]> = {
  hire: ['market'],
  meeting: ['settle', 'issue'],
  grow: ['upgrade'],
}

export const ALL_FEATURES: Feature[] = STEP_ORDER.flatMap((id) => UNLOCKS[id])

/**
 * 지금 열려 있는 것 (347번): 튜토리얼이 꺼져 있으면 전부, 켜져 있으면 지금 걸음까지 연 것만. 처음 온 사람은 채용 탭만 누를 수 있고, 걸음을 하나 깰 때마다
 * 하나씩 열린다. 걸음은 회사 상태가 정하므로 다시 들어와도 그대로다.
 */
export function unlockedFeatures(company: Company, active: boolean): Feature[] {
  if (!active) {
    return ALL_FEATURES
  }
  const at = STEP_ORDER.indexOf(tutorialStep(company).id)
  return STEP_ORDER.slice(0, at + 1).flatMap((id) => UNLOCKS[id])
}

/**
 * 회사 상태로 지금 걸음을 정한다: 직원이 없으면 뽑기, 종목회의를 아직 정하지 않았으면 종목회의, 그 뒤는 키우기(끝내기). 정한
 * 회의는 다음 회의를 열 때까지 결과로 남으므로(invest.outcome), 튜토리얼을 끝내지 않고 다음 회의를 열면 그 회의를 정할 때까지 종목회의 걸음으로 돌아간다.
 */
export function tutorialStep(company: Company): TutorialStep {
  if (company.employees.length === 0) {
    return {
      id: 'hire',
      n: 1,
      title: '직원 뽑기',
      text: '채용 탭에서 다이아로 사람을 뽑습니다. 카드가 뒤집히며 등급이 드러납니다. 뽑힌 직원은 바로 자리에 앉아 1초마다 돈을 벌어 옵니다.',
      tab: 'market',
      spot: 'market',
      short: '채용 탭에서 직원을 뽑자',
    }
  }
  if (company.invest?.outcome == null) {
    return {
      id: 'meeting',
      n: 2,
      title: '종목회의',
      text: '이슈 탭에서 종목회의를 엽니다. 직원이 종목을 물어 오면 기사를 읽고 직원 의견을 들은 뒤 매수·매도를 직접 선택합니다. 회의 기회는 한 시간에 하나씩 생겨 세 개까지 쌓입니다.',
      tab: 'meeting',
      spot: 'settle',
      short: '이슈 탭에서 종목회의를 열고 직접 고르자',
    }
  }
  return {
    id: 'grow',
    n: 3,
    title: '회사 키우기',
    text: '자본이 모이면 위의 버튼이 반짝입니다. 눌러서 사무실을 넓히거나 새 건물로 옮기세요. 자리가 늘어 직원을 더 뽑을 수 있고, 뽑기 등급이 오릅니다. 랜드마크 타워에 올라도 끝이 아닙니다!',
    spot: 'upgrade',
    short: '기록·건물 키우기가 열렸다. 랜드마크 타워까지!',
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
  revision: number
  /** 아직 한 번도 튜토리얼을 고르거나 끝내지 않았다: 처음 온 사람. */
  fresh: boolean
  start: () => void
  finish: () => void
}>((set) => ({
  active: stored() === 'on',
  revision: 0,
  fresh: stored() === null,
  start: () => {
    store('on')
    set((s) => ({ active: true, fresh: false, revision: s.revision + 1 }))
  },
  finish: () => {
    store('done')
    set({ active: false, fresh: false })
  },
}))
