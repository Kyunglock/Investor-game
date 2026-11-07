/**
 * 문자 지도로 그리는 도트 그림(건물·장면, decisions.md 142번). 그림은 이미지 파일이 아니라 코드다 (설계 7.1절).
 * 한 글자가 한 칸이고 '.'은 투명이다. 사람은 이제 고양이(cat/, 341번)라 여기엔 격자를 사각형 띠로 바꾸는 도구만 남았다.
 */

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
