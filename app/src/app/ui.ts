import type { Company } from '@web/api/client'
import { create } from 'zustand'

/** 아래 탭 (decisions.md 309·312번): 사무실 · 채용 · 배치 · 이슈 · 기록. 웹의 탭(이슈·채용·배치·지난 결산·연표)을 폰 화면에 맞게 다시 나눴다. */
export type Tab = 'office' | 'market' | 'staff' | 'issue' | 'record'

/**
 * 인력 관리의 자리 카드와 메인 화면의 설정·확장·멘탈·전투 강화(367번) 시트. assault는 주 게임 매도벽 돌파 스테이지 선택, side는 보조게임
 * (종목회의·멘탈 보호 스테이지) 메뉴다 (#698).
 */
export type ToyPanel = 'upgrade' | 'stage' | 'settings' | 'battle' | 'weapons' | 'assault' | 'side'

/**
 * 들어갈 멘탈 전투 (decisions.md 369·414번): 매도벽 돌파 스테이지(주 게임, #698), 멘탈 보호 번호 스테이지, EX 디펜스, 또는 종목 회의 뒤
 * 전투(매도벽 돌파).
 */
export type BattleEntry =
  | { kind: 'assault'; stage: number }
  | { kind: 'stage'; stage: number }
  | { kind: 'ex' }
  | { kind: 'invest'; mode: 'DEFENSE' | 'ASSAULT'; level: number }
/** 인력 관리의 시트 (decisions.md 412번): 팀(desk), 앉은 직원 상세(employee), 휴게실 동료를 보낼 팀 고르기(lounge). */
export type Sheet =
  | { kind: 'desk'; desk: string }
  | { kind: 'employee'; id: number }
  | { kind: 'lounge'; id: number }
  | { kind: 'toy'; panel: ToyPanel }

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
  settleRequest: 0,
  battle: null,
  investOpen: false,
  setInvestOpen: (investOpen) => set({ investOpen }),
  startBattle: (battle) => set({ battle, sheet: null, investOpen: false }),
  endBattle: () => set({ battle: null }),
  rivalRise: null,
  setRivalRise: (rivalRise) => set({ rivalRise }),
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

/** 탭에 다는 표: 이슈는 !(조짐·시대 끝), 채용은 채용권 수, 배치는 앉힌 수. */
export function tabBadge(company: Company, tab: Tab): string | null {
  const m = company.meeting
  switch (tab) {
    case 'issue':
      return m && (m.omen || m.eraEnding) ? '!' : null
    case 'market':
      return company.gacha.tickets > 0 ? String(company.gacha.tickets) : null
    case 'staff':
      return `${company.employees.filter((e) => e.desk).length}/${company.seats}`
    default:
      return null
  }
}

/** 회사를 처음 열 때는 준비된 사무실부터 보여 준다. */
export function firstTab(_company: Company): Tab {
  return 'office'
}
