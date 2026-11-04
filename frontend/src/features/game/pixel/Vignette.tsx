import { memo } from 'react'
import { usePixelArt } from '../pixelArt'
import type { SpriteSpec } from './layers'
import type { MoodKey } from './moods'
import { Person } from './Person'
import { PALETTE } from './palette'
import { SCENE_HEIGHT, SCENE_WIDTH } from './scenes'
import { SPRITE_HEIGHT, toRects } from './sprite'
import { type CreditArt, VIGNETTES } from './vignettes'

/** 크레딧의 장 그림 (#23). me는 진행 화면과 같은 캐릭터(장식·약점 표시)로 그린다. */
export const Vignette = memo(function Vignette({
  art,
  me,
  mood = null,
}: {
  art: CreditArt
  me: Omit<SpriteSpec, 'stage'>
  /** 모두의 표정 (순간 그림). 없으면 평소 얼굴 */
  mood?: MoodKey | null
}) {
  // 그림을 껐으면 그리지 않는다 (decisions.md 190번).
  const shown = usePixelArt((s) => s.shown)
  if (!shown) {
    return null
  }
  const background = toRects(
    VIGNETTES[art.vignette].map((row) => [...row]),
    PALETTE,
  )
  return (
    <svg
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      className="mx-auto mb-5 block h-auto w-full max-w-[384px] rounded-sm"
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
      data-testid="credits-art"
      data-vignette={art.vignette}
    >
      {background.map((r) => (
        <rect key={`b-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
      ))}
      {art.figures.map((figure, i) => (
        <Person
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 그림 안에서 사람 순서는 바뀌지 않는다
          key={i}
          figure={figure}
          me={me}
          mood={mood}
          top={SCENE_HEIGHT - SPRITE_HEIGHT}
        />
      ))}
    </svg>
  )
})
