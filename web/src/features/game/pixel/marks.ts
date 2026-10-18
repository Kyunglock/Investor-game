import type { Stats } from '../../../api/client'
import type { Layer } from './sprite'

/** 약점 표시 다섯. 머리 옆에 작게 붙는다. 약점이 바뀌면 떨어져 나간다 (설계 7.1절, 4.4절). */
export const MARKS: Record<keyof Stats, Layer> = {
  // 눈치 없는: 물음표
  insight: {
    paint: (put, ht) => {
      for (const [dy, dx] of [
        [-1, 12],
        [-1, 13],
        [-1, 14],
        [0, 14],
        [1, 13],
        [2, 13],
        [4, 13],
      ]) {
        put(ht + dy, dx, 'R')
      }
    },
  },
  // 성질 급한: 화 자국
  patience: {
    paint: (put, ht) => {
      for (const [dy, dx] of [
        [-1, 13],
        [0, 12],
        [0, 14],
        [1, 13],
        [2, 12],
        [2, 14],
        [3, 13],
      ]) {
        put(ht + dy, dx, 'R')
      }
    },
  },
  // 겁 많은: 식은땀과 떨림
  courage: {
    paint: (put, ht) => {
      put(ht + 2, 12, 'B')
      put(ht + 3, 12, 'B')
      put(ht + 3, 13, 'B')
      put(ht + 4, 12, 'B')
      put(ht + 3, 2, 'k')
      put(ht + 4, 1, 'k')
      put(ht + 5, 2, 'k')
    },
  },
  // 귀가 얇은: 큰 귀
  conviction: {
    paint: (put, ht) => {
      for (const dy of [3, 4, 5]) {
        put(ht + dy, 3, 's')
        put(ht + dy, 12, 's')
      }
      put(ht + 4, 2, 's')
      put(ht + 4, 13, 's')
    },
  },
  // 운 없는: 머리 옆 비구름
  luck: {
    paint: (put, ht) => {
      for (const x of [12, 13, 14]) {
        put(ht - 1, x, 'C')
      }
      for (const x of [11, 12, 13, 14, 15]) {
        put(ht, x, 'C')
      }
      put(ht + 1, 12, 'B')
      put(ht + 1, 14, 'B')
      put(ht + 2, 13, 'B')
    },
  },
}
