import type { Company } from '@web/api/client'

export type FirstPlayStep = 'welcome' | 'team' | 'ready' | 'play' | 'done'
export const FIRST_PLAY_KEY = 'investor-game.first-play.v1'

/** 첫 회사에서 종목회의를 아직 한 번도 정하지 않았다 (#803): 분기가 없어져, 첫 판은 첫 회의를 정하기 전까지다. */
export function firstMeeting(c: Company) {
  return c.number === 1 && c.invest?.outcome == null
}

export function readFirstPlay(c: Company): FirstPlayStep {
  try {
    const saved = localStorage.getItem(`${FIRST_PLAY_KEY}:${c.companyId}`)
    if (['welcome', 'team', 'ready', 'play', 'done'].includes(saved ?? ''))
      return saved as FirstPlayStep
  } catch {
    /* 저장 불가 환경에서도 이번 화면 안내는 동작한다. */
  }
  return c.invest?.outcome ? 'play' : 'welcome'
}

export function saveFirstPlay(c: Company, step: FirstPlayStep) {
  try {
    localStorage.setItem(`${FIRST_PLAY_KEY}:${c.companyId}`, step)
  } catch {
    /* 메모리 상태로 이어간다. */
  }
}

/** 예전 설명 도중에 나갔어도 미클리어라면 첫 스테이지부터 이어 간다. */
export function needsFirstStage(c: Company): boolean {
  return firstMeeting(c) && readFirstPlay(c) !== 'done' && (c.assaults?.best ?? 0) === 0
}
