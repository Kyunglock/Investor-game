import type { Game } from '../../api/client'
import { stageFor } from './pixel/bodies'
import { layersFor } from './pixel/layers'
import { Scene } from './pixel/Scene'
import { SCENES, sceneFor } from './pixel/scenes'

/** 가운데 도트 장면과 한 줄 캡션 (설계 8절). */
export function SceneCard({ game, ageYears }: { game: Game; ageYears: number }) {
  const stage = stageFor(ageYears)
  const key = sceneFor(stage, game.phase, game.job !== null && game.job !== undefined)
  const spec = layersFor(game.initialStats, game.stats, ageYears)

  return (
    <section className="overflow-hidden rounded-md border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <Scene sceneKey={key} sprite={spec} />
      <p className="px-3.5 py-2 text-[13px]">
        {SCENES[key].caption} <span className="text-faint">▾</span>
      </p>
    </section>
  )
}
