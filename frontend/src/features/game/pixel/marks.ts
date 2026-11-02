import type { Stats } from '../../../api/client'
import { fill } from './moods'
import { area, blob, type Layer, type Ramp } from './sprite'

/**
 * 약점 표시 다섯. 머리 오른쪽 위에 작게 붙는다. 약점이 바뀌면 떨어져 나간다 (설계 7.1절, 4.4절).
 * 얼굴 좌표는 bodies.ts 주석을 따른다(머리 윗줄 ht 기준).
 */
const RED: Ramp = { outline: 'w', shadow: '7', base: 'R', light: 'R' }
const SKIN: Ramp = { outline: 'v', shadow: 'S', base: 's', light: 'l' }
const CLOUD: Ramp = { outline: 'V', shadow: '4', base: 'Y', light: 'W' }

/** 굵은 선 글자: 칸마다 빨강, 둘레는 흰 테두리라 머리카락 위에서도 읽힌다 */
function glyph(rows: string[], top: number, left: number): [number, number][] {
  const cells: [number, number][] = []
  rows.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      if (ch === '#') {
        cells.push([top + dy, left + dx])
      }
    })
  })
  return cells
}

export const MARKS: Record<keyof Stats, Layer> = {
  // 눈치 없는: 물음표
  insight: {
    paint: (put, ht) => {
      blob(put, glyph(['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], ht, 25), RED)
    },
  },
  // 성질 급한: 화 자국
  patience: {
    paint: (put, ht) => {
      blob(put, glyph(['.#..#.', '##..##', '......', '##..##', '.#..#.'], ht, 24), RED)
    },
  },
  // 겁 많은: 식은땀과 떨림
  courage: {
    paint: (put, ht) => {
      put(ht + 5, 27, 'T')
      fill(put, ht + 6, [26, 27, 28], 'T')
      fill(put, ht + 7, [26, 27, 28], 'T')
      put(ht + 8, 27, 'T')
      put(ht + 6, 26, 'W')
      for (const [dy, x] of [
        [11, 3],
        [12, 2],
        [13, 3],
        [14, 2],
        [11, 28],
        [12, 29],
        [13, 28],
        [14, 29],
      ]) {
        put(ht + dy, x, 'k')
      }
    },
  },
  // 귀가 얇은: 큰 귀
  conviction: {
    paint: (put, ht) => {
      blob(put, area([ht + 11, ht + 15], [3, 5]), SKIN)
      blob(put, area([ht + 11, ht + 15], [26, 28]), SKIN)
      fill(put, ht + 13, [4, 27], 'S')
    },
  },
  // 운 없는: 머리 위 비구름과 빗방울
  luck: {
    paint: (put, ht) => {
      blob(
        put,
        [
          ...area([ht - 1, ht - 1], [24, 27]),
          ...area([ht, ht + 1], [21, 29]),
          ...area([ht + 2, ht + 2], [22, 28]),
        ],
        CLOUD,
      )
      for (const [dy, x] of [
        [4, 23],
        [5, 23],
        [5, 26],
        [6, 26],
        [4, 29],
        [5, 29],
      ]) {
        put(ht + dy, x, 'T')
      }
    },
  },
}
