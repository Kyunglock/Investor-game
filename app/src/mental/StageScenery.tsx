import { ARENA_FRAME, stageArenaMap } from './arenaMaps'
import maps from './assets/arena-maps.png'

import enemies from './assets/enemies.png'
import './stage-select.css'

/** 전투에 쓰는 지도에서 같은 거리의 가로 풍경을 보여 준다. */
export function StageScenery({ stage }: { stage: number }) {
  const map = stageArenaMap(stage)
  return (
    <>
      <svg
        className="stage-scenery"
        aria-hidden="true"
        viewBox={`${map.x} ${ARENA_FRAME.y} ${ARENA_FRAME.width} 190`}
        preserveAspectRatio="xMidYMid slice"
      >
        <image href={maps} width="1881" height="836" />
      </svg>
      <i
        aria-hidden="true"
        className="stage-scenery-monster"
        style={{ backgroundImage: `url(${enemies})` }}
      />
    </>
  )
}
