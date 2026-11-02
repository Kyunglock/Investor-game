/**
 * 문자 지도로 그리는 도트 그림. 그림은 이미지 파일이 아니라 코드다 (설계 7.1절).
 * 한 글자가 한 칸이고 '.'은 투명이다.
 */

export type PixelMap = readonly string[]

export type Put = (y: number, x: number, ch: string) => void

/** 겹 하나. 지도를 그대로 덮거나, 머리 윗줄(headTop)을 기준으로 상대 좌표에 그린다. */
export type Layer = { map: PixelMap } | { paint: (put: Put, headTop: number) => void }

export interface Body {
  headTop: number
  map: PixelMap
}

/** 장면에서 사람 하나가 차지하는 칸(장면 64×20 기준). 배치·간격은 이 단위로 센다. */
export const SPRITE_WIDTH = 16
export const SPRITE_HEIGHT = 20

/** 캐릭터 그림 자체는 두 배 해상도다 (decisions.md 142번). 장면에는 반 칸 크기로 그린다. */
export const CHAR_WIDTH = 32
export const CHAR_HEIGHT = 40
export const CHAR_SCALE = SPRITE_WIDTH / CHAR_WIDTH

/** 윤곽·그림자·기본·밝은 색 네 글자 */
export interface Ramp {
  outline: string
  shadow: string
  base: string
  light: string
}

/**
 * 칸 묶음 하나를 도트 화풍으로 칠한다: 빛은 왼쪽 위에서 오므로 위·왼쪽 가장자리는 밝게, 아래·오른쪽 가장자리는 그림자,
 * 바깥 둘레에는 윤곽선. 장식·약점 표시처럼 몸통 위에 얹는 물건을 몸통과 같은 화풍으로 그리는 데 쓴다.
 */
export function blob(put: Put, cells: readonly (readonly [number, number])[], ramp: Ramp) {
  const inside = new Set(cells.map(([y, x]) => `${y},${x}`))
  const has = (y: number, x: number) => inside.has(`${y},${x}`)
  for (const [y, x] of cells) {
    for (const [dy, dx] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      if (!has(y + dy, x + dx)) {
        put(y + dy, x + dx, ramp.outline)
      }
    }
  }
  for (const [y, x] of cells) {
    let ch = ramp.base
    if (!has(y + 1, x) || !has(y, x + 1)) {
      ch = ramp.shadow
    } else if (!has(y - 1, x) || !has(y, x - 1)) {
      ch = ramp.light
    }
    put(y, x, ch)
  }
}

/** 가로·세로 범위의 모든 칸 */
export function area(ys: [number, number], xs: [number, number]): [number, number][] {
  const cells: [number, number][] = []
  for (let y = ys[0]; y <= ys[1]; y++) {
    for (let x = xs[0]; x <= xs[1]; x++) {
      cells.push([y, x])
    }
  }
  return cells
}

/** 몸통 위에 겹을 순서대로 포갠다. 격자 밖은 무시한다. 입력은 바꾸지 않는다. */
export function compose(body: Body, layers: Layer[]): string[][] {
  const grid = body.map.map((row) => [...row])
  const put: Put = (y, x, ch) => {
    if (grid[y] && x >= 0 && x < grid[y].length) {
      grid[y][x] = ch
    }
  }
  for (const layer of layers) {
    if ('map' in layer) {
      layer.map.forEach((row, y) => {
        ;[...row].forEach((ch, x) => {
          if (ch !== '.') {
            put(y, x, ch)
          }
        })
      })
    } else {
      layer.paint(put, body.headTop)
    }
  }
  return grid
}

export interface Rect {
  x: number
  y: number
  width: 1
  height: 1
  fill: string
  /** 지도의 글자. 눈(e)처럼 특별히 다룰 칸을 고르는 데 쓴다 */
  code: string
}

/** 격자를 1×1 사각형 목록으로. 팔레트에 없는 글자(빈 칸 포함)는 그리지 않는다. */
export function toRects(grid: string[][], palette: Record<string, string>): Rect[] {
  const rects: Rect[] = []
  grid.forEach((row, y) => {
    row.forEach((code, x) => {
      const fill = palette[code]
      if (fill) {
        rects.push({ x, y, width: 1, height: 1, fill, code })
      }
    })
  })
  return rects
}

/** 그릴 때 쓰는 가로 띠. 같은 색이 이어지는 칸을 하나로 묶어 사각형 수를 줄인다. */
export interface Run {
  x: number
  y: number
  width: number
  fill: string
}

/** 격자를 가로 띠 목록으로. 캐릭터 한 명이 천 칸을 넘으므로 장면에는 이것으로 그린다. */
export function toRuns(grid: string[][], palette: Record<string, string>): Run[] {
  const runs: Run[] = []
  grid.forEach((row, y) => {
    let current: Run | null = null
    row.forEach((code, x) => {
      const fill = palette[code]
      if (current && fill === current.fill) {
        current.width += 1
        return
      }
      current = fill ? { x, y, width: 1, fill } : null
      if (current) {
        runs.push(current)
      }
    })
  })
  return runs
}

/** 두 격자가 다른 칸만 사각형으로. 약점 표시처럼 한 겹만 따로 다룰 때 쓴다. */
export function diffRects(
  base: string[][],
  over: string[][],
  palette: Record<string, string>,
): Rect[] {
  const rects: Rect[] = []
  over.forEach((row, y) => {
    row.forEach((code, x) => {
      const fill = palette[code]
      if (fill && base[y]?.[x] !== code) {
        rects.push({ x, y, width: 1, height: 1, fill, code })
      }
    })
  })
  return rects
}
