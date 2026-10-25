import { memo } from 'react'
import { ADORNMENTS } from './adornments'
import { BODIES } from './bodies'
import type { SpriteSpec } from './layers'
import { MARKS } from './marks'
import { MOODS } from './moods'
import { PALETTE } from './palette'
import { SCENE_HEIGHT, SCENE_WIDTH, SCENES, type SceneKey } from './scenes'
import { sexLayers } from './sexes'
import { compose, type Layer, SPRITE_HEIGHT, toRects } from './sprite'
import { type Figure, RECOLOR } from './vignettes'

interface Props {
  sceneKey: SceneKey
  sprite: SpriteSpec
  /** 가족까지 세울 때. 없으면 나 혼자 anchor 자리에 (decisions.md 64번) */
  figures?: Figure[]
}

/** 배경 위에 캐릭터 전신을 겹친 장면. 카드 폭에 맞춰 늘어난다. 사각형이 천 개가 넘어 장면·캐릭터·가족이 같으면 다시 그리지 않는다. */
export const Scene = memo(
  SceneView,
  (a, b) =>
    a.sceneKey === b.sceneKey &&
    sameSpec(a.sprite, b.sprite) &&
    JSON.stringify(a.figures ?? null) === JSON.stringify(b.figures ?? null),
)

function sameSpec(a: SpriteSpec, b: SpriteSpec): boolean {
  return (
    a.stage === b.stage &&
    a.sex === b.sex &&
    a.adornment === b.adornment &&
    a.mark === b.mark &&
    (a.mood ?? null) === (b.mood ?? null)
  )
}

function SceneView({ sceneKey, sprite, figures }: Props) {
  const scene = SCENES[sceneKey]
  const background = toRects(
    scene.map.map((row) => [...row]),
    PALETTE,
  )
  const people = figures ?? [
    { who: 'me' as const, sex: sprite.sex, stage: sprite.stage, x: scene.anchor.x },
  ]
  const dy = scene.anchor.y - SPRITE_HEIGHT

  return (
    <svg
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      className="block h-auto w-full"
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
      data-testid="scene"
      data-scene={sceneKey}
      data-people={people.length}
    >
      {background.map((r) => (
        <rect key={`b-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
      ))}
      {people.map((figure, i) => {
        // 나는 장식·약점 표시·표정을 그대로, 가족은 옷·머리 색만 바꾼 맨 몸이다. 여자는 긴 머리·치마를 먼저 덧그린다.
        const layers: Layer[] = sexLayers(figure.sex, figure.stage)
        if (figure.who === 'me') {
          if (sprite.adornment) {
            layers.push(ADORNMENTS[sprite.adornment])
          }
          if (sprite.mark) {
            layers.push(MARKS[sprite.mark])
          }
        }
        if (sprite.mood) {
          layers.push(MOODS[sprite.mood])
        }
        const palette = figure.who === 'me' ? PALETTE : { ...PALETTE, ...RECOLOR[figure.who] }
        return toRects(compose(BODIES[figure.stage], layers), palette).map((r) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 장면 안에서 사람 순서는 바뀌지 않는다
            key={`p${i}-${r.x}-${r.y}`}
            x={r.x + figure.x}
            y={r.y + dy}
            width={1}
            height={1}
            fill={r.fill}
            className={r.code === 'e' ? 'animate-blink' : undefined}
          />
        ))
      })}
    </svg>
  )
}
