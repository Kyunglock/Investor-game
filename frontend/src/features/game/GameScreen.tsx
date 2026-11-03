import type { Game } from '../../api/client'
import { CrisisCard } from './CrisisCard'
import { ageAt } from './clock'
import { DecisionCard } from './DecisionCard'
import { DiaryPage } from './DiaryPage'
import { MarketPanel } from './MarketPanel'
import { OtherWindowNotice } from './OtherWindowNotice'
import { OutcomeCard } from './OutcomeCard'
import { useGameStore } from './store'
import { useAutoPlay } from './useAutoPlay'
import { useGameClock } from './useGameClock'

/**
 * 진행 화면: 가계부 수첩 한 쪽 (2026-10-22 시안 D, decisions.md 44번). 위에서부터 신원 → 장면 → 돈 장부 탭 → 요즘 있었던 일 → 접어 둔 성격
 * (decisions.md 159번). 넓은 화면에서도 한 줄로 읽히게 폭을 줄인다. 선택·결과·매매창은 그 위에 뜬다.
 * 투자 성향 보고서는 끝난 판의 기록부에서만 본다 (#201).
 */
export function GameScreen({ game }: { game: Game }) {
  useGameClock()
  useAutoPlay()
  // 시계는 0.1초마다 흐르지만 수첩은 나이(년)만 보므로, 해가 바뀔 때만 다시 그린다.
  const ageYears = useGameStore((s) => ageAt(game.startAge, s.day, game.daysPerYear).years)
  const outcome = useGameStore((s) => s.outcome)
  const choosing = useGameStore((s) => s.choosing)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const crisisAlert = useGameStore((s) => s.crisisAlert)
  const { choose, revealOutcome, dismissOutcome, dismissCrisis } = useGameStore.getState()

  return (
    <>
      <OtherWindowNotice />
      {marketOpen && <MarketPanel game={game} />}
      {outcome ? (
        <OutcomeCard outcome={outcome} onReveal={revealOutcome} onContinue={dismissOutcome} />
      ) : crisisAlert ? (
        <CrisisCard entry={crisisAlert} game={game} onDone={dismissCrisis} />
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
      <div className="mx-auto flex w-full max-w-3xl overflow-hidden rounded bg-paper font-note text-[14px] leading-relaxed text-pen shadow-[0_2px_0_#d5d2cb,0_16px_36px_rgba(34,53,92,0.14)]">
        <DiaryPage game={game} ageYears={ageYears} />
      </div>
    </>
  )
}
