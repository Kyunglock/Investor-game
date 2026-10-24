import type { Layer } from './sprite'

/**
 * 표정 네 가지 (decisions.md 62번). 머리 윗줄(headTop)을 기준으로 얼굴 줄만 덧칠한다: 눈은 ht+4의 5·10열, 입은 ht+6의 7·8열. 장식·약점 표시 위에
 * 마지막으로 포개므로 안경 같은 장식과 겹치면 표정이 이긴다.
 */
export type MoodKey = 'joy' | 'confident' | 'despair' | 'frugal'

export const MOODS: Record<MoodKey, Layer> = {
  // 기쁨: 웃는 눈(^ ^), 활짝 벌린 입, 볼 홍조
  joy: {
    paint: (put, ht) => {
      for (const x of [4, 6, 9, 11]) {
        put(ht + 4, x, 'k')
      }
      for (const x of [5, 10]) {
        put(ht + 3, x, 'k')
        put(ht + 4, x, 's')
      }
      for (const x of [6, 7, 8, 9]) {
        put(ht + 6, x, 'm')
      }
      put(ht + 5, 4, 'r')
      put(ht + 5, 11, 'r')
    },
  },
  // 자신감: 선글라스, 한쪽만 올라간 입
  confident: {
    paint: (put, ht) => {
      for (const x of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        put(ht + 4, x, 'k')
      }
      for (const x of [4, 5, 6, 9, 10, 11]) {
        put(ht + 5, x, 'k')
      }
      put(ht + 6, 7, 's')
      put(ht + 6, 8, 'm')
      put(ht + 6, 9, 'm')
      put(ht + 5, 9, 'm')
    },
  },
  // 좌절: 처진 눈썹, 눈물, 내려간 입
  despair: {
    paint: (put, ht) => {
      put(ht + 3, 4, 'k')
      put(ht + 3, 11, 'k')
      put(ht + 2, 5, 'k')
      put(ht + 2, 10, 'k')
      for (const dy of [5, 6]) {
        put(ht + dy, 5, 'B')
        put(ht + dy, 10, 'B')
      }
      put(ht + 6, 7, 's')
      put(ht + 6, 8, 's')
      put(ht + 6, 6, 'm')
      put(ht + 6, 9, 'm')
      put(ht + 7, 7, 'm')
      put(ht + 7, 8, 'm')
    },
  },
  // 근심(긴축): 찌푸린 눈썹, 식은땀, 꾹 다문 작은 입
  frugal: {
    paint: (put, ht) => {
      put(ht + 3, 5, 'k')
      put(ht + 3, 6, 'k')
      put(ht + 3, 9, 'k')
      put(ht + 3, 10, 'k')
      put(ht + 2, 12, 'B')
      put(ht + 3, 12, 'B')
      put(ht + 6, 7, 's')
      put(ht + 6, 8, 'm')
    },
  },
}
