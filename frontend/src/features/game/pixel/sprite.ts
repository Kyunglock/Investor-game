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

export const SPRITE_WIDTH = 16
export const SPRITE_HEIGHT = 20

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
