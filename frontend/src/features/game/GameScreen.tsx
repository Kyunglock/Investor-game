import type { Game } from '../../api/client'
import { ageAt } from './clock'
import { DecisionCard } from './DecisionCard'
import { DiaryPage } from './DiaryPage'
import { LedgerPage } from './LedgerPage'
import { MarketPanel } from './MarketPanel'
import { OutcomeCard } from './OutcomeCard'
import { useGameStore } from './store'
import { useGameClock } from './useGameClock'

/**
 * 진행 화면: 펼친 가계부 수첩 (2026-10-22 시안 D, decisions.md 44번). 왼쪽 쪽은 나(신원·장면·성격·요즘 있었던 일), 오른쪽 쪽은 돈(전 재산·가계부·
 * 주식·집). 좁은 화면에서는 왼쪽 쪽이 위로 쌓인다. 선택·결과·매매창은 그 위에 뜬다.
 */
export function GameScreen({ game }: { game: Game }) {
  useGameClock()
  // 시계는 0.1초마다 흐르지만 수첩은 나이(년)만 보므로, 해가 바뀔 때만 다시 그린다.
  const ageYears = useGameStore((s) => ageAt(game.startAge, s.day, game.daysPerYear).years)
  const outcome = useGameStore((s) => s.outcome)
  const choosing = useGameStore((s) => s.choosing)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const { choose, revealOutcome, dismissOutcome } = useGameStore.getState()

  return (
    <>
      {marketOpen && <MarketPanel game={game} />}
      {outcome ? (
        <OutcomeCard outcome={outcome} onReveal={revealOutcome} onContinue={dismissOutcome} />
      ) : game.pendingEvent ? (
        <DecisionCard
          event={game.pendingEvent}
          game={game}
          busy={choosing}
          onChoose={(option, quantity) => {
            void choose(option, quantity)
          }}
        />
      ) : null}
      <div className="flex flex-wrap overflow-hidden rounded bg-paper font-note text-[14px] leading-relaxed text-pen shadow-[0_2px_0_#d5d2cb,0_16px_36px_rgba(34,53,92,0.14)]">
        <DiaryPage game={game} ageYears={ageYears} />
        <div
          aria-hidden="true"
          className="paper-binding hidden w-[22px] flex-none border-x border-[#e4e1da] md:block"
        />
        <LedgerPage game={game} ageYears={ageYears} />
      </div>
    </>
  )
}
