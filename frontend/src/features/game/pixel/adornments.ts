import type { Stats } from '../../../api/client'
import { clearEyes, fill } from './moods'
import { area, blob, type Layer, type Ramp } from './sprite'

/**
 * 강점 머리장식 다섯과 특별 별명 둘. 얼굴 좌표는 bodies.ts 주석을 따른다(머리 윗줄 ht 기준, 설계 7.1절).
 * 눈은 덮지 않는다 (돌부처만 눈을 감는다).
 */
export type AdornmentKey = keyof Stats | 'genius' | 'rough'

const GOLD: Ramp = { outline: 'o', shadow: 'D', base: 'y', light: 'F' }
const RED: Ramp = { outline: '7', shadow: '7', base: 'R', light: '8' }
const CLOVER: Ramp = { outline: 'q', shadow: 'L', base: 'L', light: 'B' }

export const ADORNMENTS: Record<AdornmentKey, Layer> = {
  // 족집게: 동그란 안경
  insight: {
    paint: (put, ht) => {
      for (const left of [9, 18]) {
        fill(put, ht + 11, [left + 1, left + 2, left + 3], 'k')
        fill(put, ht + 15, [left + 1, left + 2, left + 3], 'k')
        for (const dy of [12, 13, 14]) {
          fill(put, ht + dy, [left, left + 4], 'k')
        }
      }
      fill(put, ht + 12, [7, 8, 14, 15, 16, 17, 23, 24], 'k')
    },
  },
  // 돌부처: 감은 눈(‿), 목에 건 염주
  patience: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(put, ht + 13, [9, 13, 18, 22], 'k')
      fill(put, ht + 14, [10, 11, 12, 19, 20, 21], 'k')
      const beads: [number, number][] = [
        [20, 10],
        [20, 21],
        [21, 11],
        [21, 20],
        [22, 12],
        [22, 19],
        [23, 13],
        [23, 14],
        [23, 15],
        [23, 16],
        [23, 17],
        [23, 18],
      ]
      beads.forEach(([dy, x], i) => {
        put(ht + dy, x, i % 2 === 0 ? 'n' : 'N')
      })
    },
  },
  // 불도저: 노란 안전모
  courage: {
    paint: (put, ht) => {
      blob(
        put,
        [
          ...area([ht - 1, ht - 1], [12, 19]),
          ...area([ht, ht], [9, 22]),
          ...area([ht + 1, ht + 1], [8, 23]),
          ...area([ht + 2, ht + 4], [7, 24]),
          ...area([ht + 5, ht + 5], [5, 26]),
        ],
        GOLD,
      )
      fill(put, ht + 1, [15, 16], 'F')
      fill(put, ht + 2, [15, 16], 'F')
    },
  },
  // 소신파: 붉은 머리띠, 오른쪽으로 매듭 끝이 날린다
  conviction: {
    paint: (put, ht) => {
      blob(
        put,
        [
          ...area([ht + 6, ht + 7], [5, 26]),
          [ht + 7, 27],
          [ht + 8, 27],
          [ht + 9, 27],
          [ht + 9, 28],
        ],
        RED,
      )
    },
  },
  // 행운아: 머리 오른쪽 위 네잎클로버
  luck: {
    paint: (put, ht) => {
      blob(
        put,
        [
          ...area([ht - 1, ht], [21, 22]),
          ...area([ht - 1, ht], [25, 26]),
          ...area([ht + 2, ht + 3], [21, 22]),
          ...area([ht + 2, ht + 3], [25, 26]),
          ...area([ht + 1, ht + 1], [23, 24]),
          [ht + 4, 24],
          [ht + 5, 25],
        ],
        CLOVER,
      )
    },
  },
  // 타고난 투자 천재: 보석 박힌 왕관
  genius: {
    paint: (put, ht) => {
      blob(
        put,
        [
          ...area([ht - 1, ht + 1], [10, 11]),
          ...area([ht - 1, ht + 1], [15, 16]),
          ...area([ht - 1, ht + 1], [20, 21]),
          ...area([ht + 2, ht + 3], [10, 21]),
        ],
        GOLD,
      )
      fill(put, ht + 2, [15, 16], 'R')
    },
  },
  // 앞날이 험난한 사람: 뺨의 반창고
  rough: {
    paint: (put, ht) => {
      for (const dy of [15, 16]) {
        fill(put, ht + dy, [21, 22, 23, 24], 'w')
      }
      fill(put, ht + 15, [22], 'g')
      fill(put, ht + 16, [23], 'g')
      fill(put, ht + 14, [21, 22, 23, 24], 'S')
      fill(put, ht + 17, [21, 22, 23, 24], 'S')
    },
  },
}
