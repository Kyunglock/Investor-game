import { ADORNMENTS } from './adornments'
import { bodyFor } from './bodies'
import type { SpriteSpec } from './layers'
import { MARKS } from './marks'
import { EYELIDS, MOODS, type MoodKey } from './moods'
import { CHARACTER_PALETTE } from './palette'
import { canBlink } from './SpriteView'
import { CHAR_SCALE, compose, diffRects, type Layer, toRuns } from './sprite'
import { type Figure, RECOLOR } from './vignettes'

/**
 * 장면·크레딧 그림 속 사람 하나. 캐릭터는 32×40이고 장면은 64×20 칸이라 반 칸 크기로 그린다 (decisions.md 142번).
 * me는 장식·약점 표시까지, 가족은 옷·머리 색만 바꾼 맨 몸이다. 표정은 모두에게 같다.
 */
export function Person({
  figure,
  me,
  mood,
  top,
}: {
  figure: Figure
  me: Pick<SpriteSpec, 'adornment' | 'mark'>
  mood: MoodKey | null
  /** 그림 맨 윗줄이 놓일 장면 행 */
  top: number
}) {
  const layers: Layer[] = []
  // 아기는 머리가 작아 얼굴 겹(장식·약점·표정·눈꺼풀) 좌표가 맞지 않는다. 맨 몸으로 그린다 (decisions.md 163번).
  const baby = figure.stage === 'baby'
  if (figure.who === 'me' && !baby) {
    if (me.adornment) {
      layers.push(ADORNMENTS[me.adornment])
    }
    if (me.mark) {
      layers.push(MARKS[me.mark])
    }
  }
  if (mood && !baby) {
    layers.push(MOODS[mood])
  }
  const body = bodyFor(figure.sex, figure.stage)
  const palette =
    figure.who === 'me' ? CHARACTER_PALETTE : { ...CHARACTER_PALETTE, ...RECOLOR[figure.who] }
  const grid = compose(body, layers)
  const blinks = !baby && canBlink({ mood, adornment: figure.who === 'me' ? me.adornment : null })
  const lids = blinks ? diffRects(grid, compose(body, [...layers, EYELIDS]), palette) : []
  return (
    <g transform={`translate(${figure.x} ${top}) scale(${CHAR_SCALE})`}>
      {toRuns(grid, palette).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
      {lids.length > 0 && (
        <g className="animate-lid">
          {lids.map((r) => (
            <rect key={`l-${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
          ))}
        </g>
      )}
    </g>
  )
}
