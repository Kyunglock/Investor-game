import type { Company } from '@web/api/client'
import { hirable } from '@web/features/raising/gachaRules'
import { create } from 'zustand'
import { meetingReady } from './meeting'

/**
 * 아래 탭 (decisions.md 309·312번): 사무실 · 채용 · 이슈 · 기록. 웹의 탭을 폰 화면에 맞게 다시 나눴다. 뽑은 직원은 서버가 앉히므로 배치 탭은
 * 없다 (#801).
 */
export type Tab = 'office' | 'market' | 'issue'

/**
 * 메인 화면의 설정·확장·멘탈·전투 강화(367번) 시트. assault는 주 게임 매도벽 돌파 스테이지 선택, side는 보조게임
 * (종목회의·멘탈 보호 스테이지) 메뉴다 (#698).
 */
export type ToyPanel = 'upgrade' | 'stage' | 'settings' | 'battle' | 'assault' | 'side'

/**
 * 들어갈 멘탈 전투 (decisions.md 369·414번): 매도벽 돌파 스테이지(주 게임, #698), 멘탈 보호 번호 스테이지, EX 디펜스, 또는 종목 회의 뒤
 * 전투(매도벽 돌파).
 */
export type BattleEntry =
  | { kind: 'assault'; stage: number; tutorial?: boolean }
  | { kind: 'stage'; stage: number }
  | { kind: 'ex' }
  | { kind: 'invest'; mode: 'DEFENSE' | 'ASSAULT'; level: number }
/**
 * 시트: employee는 채용 화면의 우리 직원 목록에서 여는 직원 상세다 (#801). weapons는 전투에서 무기를 바꾸러 올 때 여는 성장 › 인벤토리다
 * (489번).
 */
export type Sheet =
  | { kind: 'employee'; id: number }
  | { kind: 'toy'; panel: ToyPanel }
  | { kind: 'weapons' }

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

  /** 지금 치르는 멘탈 전투. 없으면 null. */
  battle: BattleEntry | null
  investOpen: boolean
  setInvestOpen: (open: boolean) => void
  startBattle: (entry: BattleEntry) => void
  endBattle: () => void
  /** 확장으로 밀어낸 쪽 (decisions.md 415번, #577). 사무실을 처음 볼 때 그 자리에 새 라이벌이 밑에서 위로 지어지고 지워진다. */
  rivalRise: 'left' | 'right' | null
  setRivalRise: (side: 'left' | 'right' | null) => void
}

export const useAppUi = create<UiState>((set, get) => ({
  tab: 'office',
  modalBack: null,
  setModalBack: (modalBack) => set({ modalBack }),
  sheet: null,

  battle: null,
  investOpen: false,
  setInvestOpen: (investOpen) => set({ investOpen }),
  startBattle: (battle) => set({ battle, sheet: null, investOpen: false }),
  endBattle: () => set({ battle: null }),
  rivalRise: null,
  setRivalRise: (rivalRise) => set({ rivalRise }),

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

/**
 * 웹의 튜토리얼이 가리키는 탭을 앱 탭으로 (TutorialBanner가 store.tab을 바꾼다). 없어진 배치 탭(staff)을 가리키는 옛 링크는 사무실로 간다
 * (#801).
 */
export function tabFromWeb(tab: string | null): Tab | null {
  switch (tab) {
    case 'market':
      return 'market'
    // 없앤 탭으로 오는 옛 링크는 사무실로 간다 (524·525번).
    case 'staff':
    case 'record':
    case 'history':
      return 'office'
    case 'meeting':
      return 'issue'

    default:
      return null
  }
}

/** 탭에 다는 표: 이슈는 !(종목회의를 열거나 이어 갈 수 있다, #803), 채용은 지금 데려올 수 있는 직원 수(다이아와 남은 자리 가운데 작은 쪽, 526번). */
export function tabBadge(company: Company, tab: Tab): string | null {
  switch (tab) {
    case 'issue':
      return meetingReady(company) ? '!' : null
    case 'market':
      return hirable(company) > 0 ? String(hirable(company)) : null
    default:
      return null
  }
}

/** 회사를 처음 열 때는 준비된 사무실부터 보여 준다. */
export function firstTab(_company: Company): Tab {
  return 'office'
}
