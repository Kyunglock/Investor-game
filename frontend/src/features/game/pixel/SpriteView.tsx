import { useEffect, useRef, useState } from 'react'
import { ADORNMENTS } from './adornments'
import { BODIES } from './bodies'
import type { SpriteSpec } from './layers'
import { MARKS } from './marks'
import { MOODS } from './moods'
import { PALETTE } from './palette'
import { sexLayers } from './sexes'
import {
  compose,
  diffRects,
  type Layer,
  type Rect,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  toRects,
} from './sprite'

const DROP_MS = 500
const FACE_ROWS = 10

interface Props {
  spec: SpriteSpec
  /** 화면 폭(px). 높이는 비율대로 */
  size: number
  /** face: 머리 윗부분 10줄만 */
  crop?: 'face' | 'full'
  className?: string
}

/** 캐릭터 한 명. 눈은 깜빡이고, 약점 표시가 바뀌면 옛 표시가 떨어지며 사라진다 (설계 4.4절). */
export function Sprite({ spec, size, crop = 'full', className = '' }: Props) {
  const body = BODIES[spec.stage]
  const baseLayers: Layer[] = [
    ...sexLayers(spec.sex, spec.stage),
    ...(spec.adornment ? [ADORNMENTS[spec.adornment]] : []),
  ]
  const base = compose(body, baseLayers)
  // 표정은 장식·약점 표시 위에 마지막으로 포갠다. 약점 표시가 떨어지는 연출은 표정과 무관하다.
  const mood: Layer[] = spec.mood ? [MOODS[spec.mood]] : []
  const withMark = compose(body, [...baseLayers, ...(spec.mark ? [MARKS[spec.mark]] : []), ...mood])
  const markRects = diffRects(base, withMark, PALETTE)

  const [dropping, setDropping] = useState<Rect[]>([])
  // 약점이 바뀐 렌더에서만 옛 표시를 떨어뜨린다. 표시 칸 목록은 매 렌더 새로 계산되므로 ref로 들고 있는다.
  const latestRects = useRef(markRects)
  latestRects.current = markRects
  const previous = useRef<{ mark: SpriteSpec['mark']; rects: Rect[] }>({
    mark: spec.mark,
    rects: markRects,
  })
  useEffect(() => {
    const before = previous.current
    previous.current = { mark: spec.mark, rects: latestRects.current }
    if (before.mark === spec.mark || before.mark === null) {
      return
    }
    setDropping(before.rects)
    const id = setTimeout(() => setDropping([]), DROP_MS)
    return () => clearTimeout(id)
  }, [spec.mark])

  const top = crop === 'face' ? body.headTop - 1 : 0
  const height = crop === 'face' ? FACE_ROWS : SPRITE_HEIGHT

  return (
    <svg
      viewBox={`0 ${top} ${SPRITE_WIDTH} ${height}`}
      width={size}
      height={(size * height) / SPRITE_WIDTH}
      className={className}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {toRects(base, PALETTE).map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={1}
          height={1}
          fill={r.fill}
          className={r.code === 'e' ? 'animate-blink' : undefined}
        />
      ))}
      {markRects.map((r) => (
        <rect key={`m-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
      ))}
      {dropping.length > 0 && (
        <g className="animate-drop">
          {dropping.map((r) => (
            <rect key={`d-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
          ))}
        </g>
      )}
    </svg>
  )
}
