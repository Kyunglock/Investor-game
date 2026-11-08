import type { Company } from '@web/api/client'
import { create } from 'zustand'

/** 아래 탭 (decisions.md 309·312번): 사무실 · 채용 · 배치 · 이슈 · 기록. 웹의 탭(이슈·채용·배치·지난 결산·연표)을 폰 화면에 맞게 다시 나눴다. */
export type Tab = 'office' | 'market' | 'staff' | 'issue' | 'record'

/** 인력 관리의 자리 카드와 메인 화면의 설정·확장·멘탈·전투 강화(367번) 시트. */
export type ToyPanel = 'upgrade' | 'stage' | 'settings' | 'battle'

/** 들어갈 멘탈 전투 (decisions.md 369번): 번호 스테이지(전진 모드) 또는 EX 디펜스. */
export type BattleEntry = { kind: 'stage'; stage: number } | { kind: 'ex' }
export type Sheet = { kind: 'desk'; desk: string } | { kind: 'toy'; panel: ToyPanel }

interface UiState {
  tab: Tab
  modalBack: (() => void) | null
  setModalBack: (handler: (() => void) | null) => void
  sheet: Sheet | null
  setTab: (tab: Tab) => void
  openSheet: (sheet: Sheet) => void
  closeSheet: () => void
  /** 뒤로 가기: 시트가 열려 있으면 닫고, 다른 탭이면 사무실로. 더 갈 데가 없으면 false. */
  back: () => boolean
  /** 분기 넘기기를 누른 횟수. 아래 버튼이 올리고, 회의 창(Windows)이 보고 회의를 연다. */
  settleRequest: number
  requestSettle: () => void
  /** 지금 치르는 멘탈 전투. 없으면 null. */
  battle: BattleEntry | null
  startBattle: (entry: BattleEntry) => void
  endBattle: () => void
}

export const useAppUi = create<UiState>((set, get) => ({
  tab: 'office',
  modalBack: null,
  setModalBack: (modalBack) => set({ modalBack }),
  sheet: null,
  settleRequest: 0,
  battle: null,
  startBattle: (battle) => set({ battle, sheet: null }),
  endBattle: () => set({ battle: null }),
  requestSettle: () => set((s) => ({ settleRequest: s.settleRequest + 1, sheet: null })),
  setTab: (tab) => set({ tab, sheet: null }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  back: () => {
    if (get().modalBack) {
      get().modalBack?.()
      return true
    }
    if (get().sheet) {
      set({ sheet: null })
      return true
    }
    if (get().tab !== 'office') {
      set({ tab: 'office' })
      return true
    }
    return false
  },
}))

/** 웹의 튜토리얼·결산이 가리키는 탭을 앱 탭으로 (TutorialBanner가 store.tab을 바꾼다). */
export function tabFromWeb(tab: string | null): Tab | null {
  switch (tab) {
    case 'market':
      return 'market'
    case 'staff':
      return 'staff'
    case 'meeting':
      return 'issue'
    case 'settlement':
    case 'history':
      return 'record'
    default:
      return null
  }
}

/** 탭에 다는 표: 이슈는 !(조짐·시대 끝·이직·연봉), 채용은 채용권 수, 배치는 앉힌 수. */
export function tabBadge(company: Company, tab: Tab): string | null {
  const m = company.meeting
  switch (tab) {
    case 'issue':
      return m && (m.omen || m.eraEnding || m.poach || m.raise) ? '!' : null
    case 'market':
      return company.gacha.tickets > 0 ? String(company.gacha.tickets) : null
    case 'staff':
      return `${company.employees.filter((e) => e.desk).length}/${company.seats}`
    default:
      return null
  }
}

/** 회사를 처음 열 때 설 탭: 직원이 없으면 채용, 있으면 사무실. */
export function firstTab(company: Company): Tab {
  return company.employees.length === 0 && company.status !== 'ENDED' ? 'market' : 'office'
}
