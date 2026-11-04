import { ADORNMENTS } from './adornments'
import { bodyFor } from './bodies'
import type { SpriteSpec } from './layers'
import { babyHair, CARRY, lookFor } from './looks'
import { MARKS } from './marks'
import { EYELIDS, MOODS, type MoodKey } from './moods'
import { CHARACTER_PALETTE } from './palette'
import { canBlink } from './SpriteView'
import {
  blob,
  CHAR_HEIGHT,
  CHAR_SCALE,
  CHAR_WIDTH,
  compose,
  diffRects,
  type Layer,
  type Run,
  toRuns,
} from './sprite'
import { type Carried, type Figure, SPOUSE_RECOLOR } from './vignettes'

/**
 * 장면·크레딧 그림 속 사람 하나. 캐릭터는 32×40이고 장면은 64×20 칸이라 반 칸 크기로 그린다 (decisions.md 142번).
 * me는 장식·약점 표시까지, 가족은 옷·머리 색만 바꾼 맨 몸이다(아이는 저마다 다른 색, looks.ts). 표정은 모두에게 같다.
 * 아기를 업었으면 등 뒤에 포대기와 아기 머리를, 앞가슴에 포대기 끈을 그린다 (decisions.md 178번).
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
  // 아기는 머리가 작아 얼굴 겹(장식·약점·표정·눈꺼풀) 좌표가 맞지 않는다. 배냇머리만 얹는다 (decisions.md 163·178번).
  const baby = figure.stage === 'baby'
  if (baby) {
    layers.push(babyHair(figure.look ?? 0))
  }
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
  const palette = paletteFor(figure.who, figure.look ?? 0)
  const grid = compose(body, layers)
  const blinks = !baby && canBlink({ mood, adornment: figure.who === 'me' ? me.adornment : null })
  const lids = blinks ? diffRects(grid, compose(body, [...layers, EYELIDS]), palette) : []
  const carried = figure.carrying
  return (
    <g transform={`translate(${figure.x} ${top}) scale(${CHAR_SCALE})`}>
      {carried && <Runs runs={backOf(carried, body.headTop)} />}
      <Runs runs={toRuns(grid, palette)} />
      {carried && <Runs runs={strapOf(carried, body.map, body.headTop)} />}
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

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((r) => (
    <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
  ))
}

function paletteFor(who: Figure['who'], look: number): Record<string, string> {
  if (who === 'me') {
    return CHARACTER_PALETTE
  }
  return { ...CHARACTER_PALETTE, ...(who === 'spouse' ? SPOUSE_RECOLOR : lookFor(look)) }
}

/** 포대기는 아기 옷 색(글자 5·3·1·2)이라 아이마다 다르다. */
const BLANKET = { outline: '5', shadow: '3', base: '1', light: '2' }
/** 업은 사람 칸 밖(왼쪽·오른쪽)으로 그릴 여유 */
const PAD = CHAR_WIDTH / 2

/** 업은 사람 뒤에 그릴 것: 등의 포대기(양옆으로 비죽), 그 위로 어깨 너머 아기 머리. 업은 사람 칸 좌표의 띠로 돌려준다. */
function backOf(carried: Carried, ht: number): Run[] {
  const width = CHAR_WIDTH + PAD * 2
  const grid = Array.from({ length: CHAR_HEIGHT }, () => Array<string>(width).fill('.'))
  const right = carried.side === 'right'
  const flip = (x: number) => (right ? x : CHAR_WIDTH - 1 - x)
  const put = (y: number, x: number, ch: string) => {
    const gx = x + PAD
    if (grid[y] && gx >= 0 && gx < width) {
      grid[y][gx] = ch
    }
  }
  const cells: [number, number][] = []
  for (let y = ht + 18; y <= ht + 28; y++) {
    for (let x = 2; x <= 29; x++) {
      // 아기 쪽만 어깨 위(턱 아래)까지 올라온다. 모서리는 둥글게.
      const low = y < ht + 20 && x < 20
      const corner = (y === ht + 20 && x < 4) || (y === ht + 28 && (x < 3 || x > 28))
      if (!low && !corner) {
        cells.push([y, flip(x)])
      }
    }
  }
  blob(put, cells, BLANKET)
  const baby = bodyFor(carried.sex, 'baby')
  const head = compose(baby, [babyHair(carried.look)])
  const dy = ht + CARRY.headRow - baby.headTop
  const dx = right ? CARRY.dx : -CARRY.dx
  head.forEach((row, y) => {
    if (y > baby.headTop + CARRY.chin) {
      return
    }
    row.forEach((ch, x) => {
      if (ch !== '.') {
        put(y + dy, x + dx, ch)
      }
    })
  })
  return toRuns(grid, babyPalette(carried)).map((r) => ({ ...r, x: r.x - PAD }))
}

/** 앞가슴의 포대기 끈: 옷 위 두 줄. */
function strapOf(carried: Carried, map: readonly string[], ht: number): Run[] {
  const grid = map.map((row) => [...row].map(() => '.'))
  const cloth = new Set(['q', 'd', 'c', 'C', 'w', 'g', 't', '6'])
  const rows: [number, string][] = [
    [ht + 24, '2'],
    [ht + 25, '3'],
  ]
  for (const [y, ch] of rows) {
    for (let x = 6; x <= 25; x++) {
      if (cloth.has(map[y]?.[x] ?? '.')) {
        grid[y][x] = ch
      }
    }
  }
  return toRuns(grid, babyPalette(carried))
}

const babyPalette = (carried: Carried) => ({ ...CHARACTER_PALETTE, ...lookFor(carried.look) })
