import { useEffect } from 'react'
import {
  AUTO_CHOOSE_DELAY_MS,
  AUTO_CONTINUE_DELAY_MS,
  AUTO_CRISIS_DELAY_MS,
  autoChoice,
} from './auto'
import { REVEAL_MS } from './OutcomeCard'
import { useGameStore } from './store'

/**
 * 자동 진행 (decisions.md 131번). 켜져 있으면 선택 카드는 잠깐 보여 준 뒤 성향·능력치로 고르고, 결과 카드와 위기 회고는 읽을 시간을 두고 넘기고,
 * 시계가 서 있으면 다시 돌린다. 매매창·보고서처럼 사용자가 직접 연 것은 건드리지 않는다. 판이 끝나면 크레딧은 사용자가 본다.
 */
export function useAutoPlay() {
  const autoPlay = useGameStore((s) => s.autoPlay)
  const status = useGameStore((s) => s.status)
  const eventId = useGameStore((s) => s.game?.pendingEvent?.eventId ?? null)
  const outcomeKind = useGameStore((s) => s.outcome?.kind ?? null)
  const crisis = useGameStore((s) => s.crisisAlert != null)
  const running = useGameStore((s) => s.running)
  const choosing = useGameStore((s) => s.choosing)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const reportOpen = useGameStore((s) => s.reportOpen)

  useEffect(() => {
    if (!autoPlay || status !== 'playing' || marketOpen || reportOpen) {
      return
    }
    if (outcomeKind) {
      // 뉴스·흔들림은 결과가 잠깐 감춰져 있으니 드러난 뒤에 넘긴다.
      const hidden = outcomeKind === 'NEWS' || outcomeKind === 'SHAKE' ? REVEAL_MS : 0
      const id = setTimeout(
        () => useGameStore.getState().dismissOutcome(),
        hidden + AUTO_CONTINUE_DELAY_MS,
      )
      return () => clearTimeout(id)
    }
    if (crisis) {
      const id = setTimeout(() => useGameStore.getState().dismissCrisis(), AUTO_CRISIS_DELAY_MS)
      return () => clearTimeout(id)
    }
    if (eventId) {
      if (choosing) {
        return
      }
      const id = setTimeout(() => {
        const state = useGameStore.getState()
        if (!state.autoPlay || state.game?.pendingEvent?.eventId !== eventId) {
          return
        }
        const choice = autoChoice(state.game)
        if (choice) {
          void state.choose(choice.option, choice.quantity)
        }
      }, AUTO_CHOOSE_DELAY_MS)
      return () => clearTimeout(id)
    }
    // 탭이 뒤로 가 멈춘 시계는 되살리지 않는다. 돌아오면 아래 visibilitychange가 돌린다.
    if (!running && !document.hidden) {
      useGameStore.getState().resume()
    }
  }, [autoPlay, status, eventId, outcomeKind, crisis, running, choosing, marketOpen, reportOpen])

  useEffect(() => {
    if (!autoPlay) {
      return
    }
    const onVisibility = () => {
      if (!document.hidden) {
        useGameStore.getState().resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [autoPlay])
}
