import type { Game } from '../../api/client'
import { stageFor } from './pixel/bodies'
import { layersFor } from './pixel/layers'
import { Scene } from './pixel/Scene'
import { sceneCaption, sceneFor } from './pixel/scenes'

/** 가운데 도트 장면과 한 줄 캡션 (설계 8절). */
export function SceneCard({ game, ageYears }: { game: Game; ageYears: number }) {
  const stage = stageFor(ageYears)
  // 전업투자자는 직장이 없어도 일자리를 찾는 중이 아니다 (decisions.md 35번).
  const working = (game.job !== null && game.job !== undefined) || game.fullTimeInvestor
  const key = sceneFor(stage, game.phase, working)
  const spec = layersFor(game.initialStats, game.stats, ageYears)

  return (
    <section className="overflow-hidden rounded-md border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <Scene sceneKey={key} sprite={spec} />
      <p className="px-3.5 py-2 text-[13px]">
        {sceneCaption(key, {
          tenure: game.housing.tenure,
          regionName: game.housing.regionName,
          married: game.household.married,
          children: game.household.children.length,
          fullTimeInvestor: game.fullTimeInvestor,
        })}{' '}
        <span className="text-faint">▾</span>
      </p>
    </section>
  )
}
