import type { Game } from '../../api/client'
import { AssetCurve } from './AssetCurve'
import { ageAt } from './clock'
import { DecisionCard } from './DecisionCard'
import { HouseholdCard } from './HouseholdCard'
import { IdentityCard } from './IdentityCard'
import { LifeLog } from './LifeLog'
import { LifeMap } from './LifeMap'
import { MarketPanel } from './MarketPanel'
import { OutcomeCard } from './OutcomeCard'
import { PortfolioCard } from './PortfolioCard'
import { SceneCard } from './SceneCard'
import { StatsCard } from './StatsCard'
import { useGameStore } from './store'
import { useGameClock } from './useGameClock'

/**
 * 진행 화면 3단 (설계 5.2절, 경제 개편 설계 11절). 데스크톱 280 · 1fr · 320, 태블릿 2단, 모바일 1단. 양옆 기둥은 두 줄에 걸치고
 * 가운데는 장면(첫 줄)과 인생 기록(둘째 줄)이라 기록이 장면 바로 아래 붙는다.
 * 모바일 순서: 장면 → 선택/결과 → 신원 → 능력치 → 가계부 → 포트폴리오 → 인생 기록 → 지도 → 곡선.
 */
export function GameScreen({ game }: { game: Game }) {
  useGameClock()
  // 시계는 0.1초마다 흐르지만 카드들은 나이(년)만 보므로, 해가 바뀔 때만 다시 그린다.
  const ageYears = useGameStore((s) => ageAt(game.startAge, s.day, game.daysPerYear).years)
  const outcome = useGameStore((s) => s.outcome)
  const choosing = useGameStore((s) => s.choosing)
  const marketOpen = useGameStore((s) => s.marketOpen)
  const { choose, revealOutcome, dismissOutcome } = useGameStore.getState()

  return (
    <div className="grid gap-3.5 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      {marketOpen && <MarketPanel game={game} />}
      {/* 왼쪽. 두 줄에 걸쳐 가운데의 인생 기록이 장면 바로 아래로 올라온다 (decisions.md 32번) */}
      <div className="order-3 flex flex-col gap-3.5 md:order-1 md:row-span-2">
        <IdentityCard game={game} ageYears={ageYears} />
        <StatsCard game={game} />
        <HouseholdCard game={game} />
      </div>

      {/* 가운데 위: 장면과 선택/결과 */}
      <div className="order-1 flex flex-col gap-3.5 md:order-2">
        <SceneCard game={game} ageYears={ageYears} />
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
      </div>

      {/* 가운데 아래: 인생 기록. 장면 바로 아래 둘째 줄. 모바일에서는 신원·능력치·가계부·포트폴리오 다음에 온다 */}
      <div className="order-5 flex flex-col gap-3.5 md:order-3 md:col-start-2 md:row-start-2">
        <LifeLog game={game} />
        <p className="text-center text-[11px] text-faint" data-testid="reported-day">
          서버 확인: {game.day}일
        </p>
      </div>

      {/* 오른쪽 (태블릿에서는 가운데 아래). 모바일에서는 포트폴리오가 인생 기록보다 먼저 */}
      <div className="order-4 flex flex-col gap-3.5 md:order-4 md:col-start-2 lg:col-start-3 lg:row-span-2 lg:row-start-1">
        <PortfolioCard game={game} />
        <LifeMap game={game} ageYears={ageYears} />
        <AssetCurve game={game} ageYears={ageYears} />
      </div>
    </div>
  )
}
