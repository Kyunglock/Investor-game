import { ARENA_FRAME, ARENA_SHEETS, stageArenaMap } from './arenaMaps'
import { STAGE_ASSETS } from './assets'

import { isLocalMob } from './enemies'
import './stage-select.css'

/** 전투에 쓰는 지도에서 같은 거리의 가로 풍경을 보여 준다. */
export function StageScenery({ stage }: { stage: number }) {
  const map = stageArenaMap(stage)
  const mob = map.roster.find(isLocalMob)
  const sheet = ARENA_SHEETS[map.sheet]
  return (
    <>
      <svg
        className="stage-scenery"
        aria-hidden="true"
        viewBox={`${map.x} ${sheet.y} ${ARENA_FRAME.width} 190`}
        preserveAspectRatio="xMidYMid slice"
      >
        <image href={STAGE_ASSETS[map.sheet]} width={sheet.width} height={sheet.height} />
      </svg>
      <i
        aria-hidden="true"
        className="stage-scenery-monster"
        style={{
          backgroundImage: `url(${STAGE_ASSETS[mob ?? 'enemies']})`,
          ...(mob && {
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }),
        }}
      />
    </>
  )
}
