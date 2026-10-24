import { memo } from 'react'
import { ADORNMENTS } from './adornments'
import { BODIES } from './bodies'
import type { SpriteSpec } from './layers'
import { MARKS } from './marks'
import { PALETTE } from './palette'
import { SCENE_HEIGHT, SCENE_WIDTH } from './scenes'
import { compose, type Layer, SPRITE_HEIGHT, toRects } from './sprite'
import { type CreditArt, type Figure, VIGNETTES } from './vignettes'

/** 배우자와 아이는 옷·머리 색만 바꿔 플레이어와 구분한다. */
const RECOLOR: Record<Exclude<Figure['who'], 'me'>, Record<string, string>> = {
  spouse: { c: '#b5657a', h: '#5a3a2e' },
  kid: { c: '#e3b53a', p: '#4f8fd6' },
}

/** 크레딧의 장 그림 (#23). me는 진행 화면과 같은 캐릭터(장식·약점 표시)로 그린다. */
export const Vignette = memo(function Vignette({
  art,
  me,
}: {
  art: CreditArt
  me: Omit<SpriteSpec, 'stage'>
}) {
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
      {art.figures.map((figure, i) => {
        const layers: Layer[] = []
        if (figure.who === 'me' && me.adornment) {
          layers.push(ADORNMENTS[me.adornment])
        }
        if (figure.who === 'me' && me.mark) {
          layers.push(MARKS[me.mark])
        }
        const palette = figure.who === 'me' ? PALETTE : { ...PALETTE, ...RECOLOR[figure.who] }
        const dy = SCENE_HEIGHT - SPRITE_HEIGHT
        return toRects(compose(BODIES[figure.stage], layers), palette).map((r) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 그림 안에서 사람 순서는 바뀌지 않는다
            key={`f${i}-${r.x}-${r.y}`}
            x={r.x + figure.x}
            y={r.y + dy}
            width={1}
            height={1}
            fill={r.fill}
          />
        ))
      })}
    </svg>
  )
})
