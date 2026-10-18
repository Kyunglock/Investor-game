import type { Stats } from '../../../api/client'
import type { Layer } from './sprite'

/**
 * 강점 머리장식 다섯과 특별 별명 둘. 머리 윗줄(headTop)을 기준으로 그린다 (설계 7.1절).
 * 눈은 headTop+4 줄의 5·10열이라 그 칸은 덮지 않는다 (돌부처만 눈을 감는다).
 */
export type AdornmentKey = keyof Stats | 'genius' | 'rough'

const cols = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

export const ADORNMENTS: Record<AdornmentKey, Layer> = {
  // 족집게: 동그란 안경
  insight: {
    paint: (put, ht) => {
      for (const x of [4, 5, 6, 9, 10, 11]) {
        put(ht + 3, x, 'k')
        put(ht + 5, x, 'k')
      }
      for (const x of [4, 6, 7, 8, 9, 11]) {
        put(ht + 4, x, 'k')
      }
    },
  },
  // 돌부처: 감은 눈, 염주
  patience: {
    paint: (put, ht) => {
      for (const x of [5, 6, 9, 10]) {
        put(ht + 4, x, 'k')
      }
      for (const x of cols(5, 10)) {
        put(ht + 8, x, 'n')
      }
    },
  },
  // 불도저: 노란 안전모
  courage: {
    paint: (put, ht) => {
      put(ht - 1, 7, 'y')
      put(ht - 1, 8, 'y')
      for (const x of cols(5, 10)) {
        put(ht, x, 'y')
      }
      for (const x of cols(4, 11)) {
        put(ht + 1, x, 'y')
      }
      for (const x of cols(3, 12)) {
        put(ht + 2, x, 'y')
      }
    },
  },
  // 소신파: 붉은 머리띠
  conviction: {
    paint: (put, ht) => {
      for (const x of cols(4, 11)) {
        put(ht + 2, x, 'r')
      }
      put(ht + 2, 12, 'r')
      put(ht + 3, 13, 'r')
    },
  },
  // 행운아: 머리 옆 네잎클로버
  luck: {
    paint: (put, ht) => {
      put(ht - 1, 13, 'g')
      put(ht, 12, 'g')
      put(ht, 14, 'g')
      put(ht + 1, 13, 'g')
      put(ht + 2, 13, 'g')
    },
  },
  // 타고난 투자 천재: 왕관
  genius: {
    paint: (put, ht) => {
      for (const x of [5, 7, 8, 10]) {
        put(ht - 1, x, 'y')
      }
      for (const x of cols(5, 10)) {
        put(ht, x, 'y')
      }
    },
  },
  // 앞날이 험난한 사람: 뺨의 반창고
  rough: {
    paint: (put, ht) => {
      for (const x of [9, 10, 11]) {
        put(ht + 5, x, 'w')
      }
      put(ht + 5, 10, 'k')
    },
  },
}
