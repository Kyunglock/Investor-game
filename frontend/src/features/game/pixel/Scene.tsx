import { memo } from 'react'
import { ADORNMENTS } from './adornments'
import { BODIES } from './bodies'
import type { SpriteSpec } from './layers'
import { MARKS } from './marks'
import { MOODS } from './moods'
import { PALETTE } from './palette'
import { SCENE_HEIGHT, SCENE_WIDTH, SCENES, type SceneKey } from './scenes'
import { compose, type Layer, SPRITE_HEIGHT, toRects } from './sprite'

interface Props {
  sceneKey: SceneKey
  sprite: SpriteSpec
}

/** 배경 위에 캐릭터 전신을 겹친 장면. 카드 폭에 맞춰 늘어난다. 사각형이 천 개가 넘어 장면·캐릭터가 같으면 다시 그리지 않는다. */
export const Scene = memo(
  SceneView,
  (a, b) => a.sceneKey === b.sceneKey && sameSpec(a.sprite, b.sprite),
)

function sameSpec(a: SpriteSpec, b: SpriteSpec): boolean {
  return (
    a.stage === b.stage &&
    a.adornment === b.adornment &&
    a.mark === b.mark &&
    (a.mood ?? null) === (b.mood ?? null)
  )
}

function SceneView({ sceneKey, sprite }: Props) {
  const scene = SCENES[sceneKey]
  const background = toRects(
    scene.map.map((row) => [...row]),
    PALETTE,
  )
  const layers: Layer[] = []
  if (sprite.adornment) {
    layers.push(ADORNMENTS[sprite.adornment])
  }
  if (sprite.mark) {
    layers.push(MARKS[sprite.mark])
  }
  if (sprite.mood) {
    layers.push(MOODS[sprite.mood])
  }
  const person = toRects(compose(BODIES[sprite.stage], layers), PALETTE)
  const dx = scene.anchor.x
  const dy = scene.anchor.y - SPRITE_HEIGHT

  return (
    <svg
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      className="block h-auto w-full"
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
      data-testid="scene"
      data-scene={sceneKey}
    >
      {background.map((r) => (
        <rect key={`b-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
      ))}
      {person.map((r) => (
        <rect
          key={`p-${r.x}-${r.y}`}
          x={r.x + dx}
          y={r.y + dy}
          width={1}
          height={1}
          fill={r.fill}
          className={r.code === 'e' ? 'animate-blink' : undefined}
        />
      ))}
    </svg>
  )
}
