import { useEffect, useRef, useState } from 'react'
import { ADORNMENTS } from './adornments'
import { bodyFor } from './bodies'
import type { SpriteSpec } from './layers'
import { babyHair } from './looks'
import { MARKS } from './marks'
import { EYELIDS, MOODS } from './moods'
import { CHARACTER_PALETTE } from './palette'
import {
  CHAR_HEIGHT,
  CHAR_WIDTH,
  compose,
  diffRects,
  type Layer,
  type Rect,
  toRuns,
} from './sprite'

const DROP_MS = 500
/** 얼굴만 자를 때의 줄 수. 머리 윤곽부터 턱 아래까지 */
const FACE_ROWS = 20

interface Props {
  spec: SpriteSpec
  /** 화면 폭(px). 높이는 비율대로 */
  size: number
  /** face: 머리만 */
  crop?: 'face' | 'full'
  className?: string
}

/** 깜빡일 수 있는 얼굴: 표정이 없고 눈을 감은 장식(돌부처)이 아닐 때 */
export function canBlink(spec: Pick<SpriteSpec, 'mood' | 'adornment'>): boolean {
  return !spec.mood && spec.adornment !== 'patience'
}

/**
 * 캐릭터 한 명. 눈은 깜빡이고, 약점 표시가 바뀌면 옛 표시가 떨어지며 사라진다 (설계 4.4절).
 * 아기는 머리가 작아 얼굴 겹(장식·약점·표정·눈꺼풀)이 어른 좌표에 떠 버린다: 배냇머리만 얹은 맨 몸으로 그린다 (decisions.md 163·178번).
 */
export function Sprite({ spec, size, crop = 'full', className = '' }: Props) {
  if (spec.stage === 'baby') {
    return <BabySprite spec={spec} size={size} crop={crop} className={className} />
  }
  return <GrownSprite spec={spec} size={size} crop={crop} className={className} />
}

function BabySprite({ spec, size, crop = 'full', className = '' }: Props) {
  const body = bodyFor(spec.sex, 'baby')
  const grid = compose(body, [babyHair(0)])
  // 얼굴만 자를 때는 배냇머리(ht-3)부터
  const top = crop === 'face' ? body.headTop - 4 : 0
  const height = crop === 'face' ? FACE_ROWS : CHAR_HEIGHT
  return (
    <svg
      viewBox={`0 ${top} ${CHAR_WIDTH} ${height}`}
      width={size}
      height={(size * height) / CHAR_WIDTH}
      className={className}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {toRuns(grid, CHARACTER_PALETTE).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </svg>
  )
}

function GrownSprite({ spec, size, crop = 'full', className = '' }: Props) {
  const body = bodyFor(spec.sex, spec.stage)
  const baseLayers: Layer[] = spec.adornment ? [ADORNMENTS[spec.adornment]] : []
  const base = compose(body, baseLayers)
  // 표정은 장식·약점 표시 위에 마지막으로 포갠다. 약점 표시가 떨어지는 연출은 표정과 무관하다.
  const mood: Layer[] = spec.mood ? [MOODS[spec.mood]] : []
  const withMark = compose(body, [...baseLayers, ...(spec.mark ? [MARKS[spec.mark]] : []), ...mood])
  const markRects = diffRects(base, withMark, CHARACTER_PALETTE)
  const lids = canBlink(spec)
    ? diffRects(withMark, compose(body, [...baseLayers, EYELIDS]), CHARACTER_PALETTE)
    : []

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
  const height = crop === 'face' ? FACE_ROWS : CHAR_HEIGHT

  return (
    <svg
      viewBox={`0 ${top} ${CHAR_WIDTH} ${height}`}
      width={size}
      height={(size * height) / CHAR_WIDTH}
      className={className}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {toRuns(base, CHARACTER_PALETTE).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
      {markRects.map((r) => (
        <rect key={`m-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
      ))}
      {lids.length > 0 && (
        <g className="animate-lid">
          {lids.map((r) => (
            <rect key={`l-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
          ))}
        </g>
      )}
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
