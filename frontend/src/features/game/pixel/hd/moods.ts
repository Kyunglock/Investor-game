import type { MoodKey } from '../moods'
import type { Layer, Put } from '../sprite'

/** 같은 값을 여러 칸에 */
function fill(put: Put, y: number, xs: number[], ch: string) {
  for (const x of xs) {
    put(y, x, ch)
  }
}

/** 원래 눈(2×2)을 지운다 */
function clearEyes(put: Put, ht: number) {
  for (const dy of [9, 10]) {
    fill(put, ht + dy, [10, 11, 20, 21], 's')
  }
}

/**
 * 고해상도 시안의 표정 넷. 기존 MOODS와 같은 이름·뜻이다 (decisions.md 62번).
 * 좌표는 adult.ts 주석의 얼굴 좌표를 따른다.
 */
export const HD_MOODS: Record<MoodKey, Layer> = {
  // 기쁨: 웃는 눈(^ ^), 활짝 웃는 입, 볼 홍조
  joy: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(put, ht + 9, [10, 11, 20, 21], 'k')
      fill(put, ht + 10, [9, 12, 19, 22], 'k')
      fill(put, ht + 11, [9, 10, 21, 22], 'r')
      fill(put, ht + 13, [15, 16], 's')
      fill(put, ht + 12, [13, 18], 'm')
      fill(put, ht + 13, [14, 15, 16, 17], 'M')
      fill(put, ht + 14, [15, 16], 'm')
    },
  },
  // 자신감: 선글라스(반짝임 포함), 한쪽만 올라간 입
  confident: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(put, ht + 9, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], 'k')
      fill(put, ht + 10, [9, 10, 11, 12, 13, 18, 19, 20, 21, 22], 'K')
      fill(put, ht + 11, [10, 11, 12, 19, 20, 21], 'K')
      fill(put, ht + 10, [10, 19], 'W')
      fill(put, ht + 13, [15], 's')
      fill(put, ht + 13, [16, 17], 'm')
      fill(put, ht + 12, [18], 'm')
    },
  },
  // 좌절: 안쪽이 올라간 눈썹, 흐르는 눈물, 처진 입
  despair: {
    paint: (put, ht) => {
      fill(put, ht + 8, [11, 20], 's')
      fill(put, ht + 8, [9, 10, 21, 22], 'j')
      fill(put, ht + 7, [11, 12, 19, 20], 'j')
      for (const dy of [11, 12, 13]) {
        fill(put, ht + dy, [10, 21], 'T')
      }
      fill(put, ht + 13, [15, 16], 'm')
      fill(put, ht + 14, [14, 17], 'm')
    },
  },
  // 근심(긴축): 미간을 찌푸린 눈썹, 머리 옆 식은땀, 꾹 다문 입
  frugal: {
    paint: (put, ht) => {
      fill(put, ht + 8, [10, 21], 's')
      fill(put, ht + 7, [10, 21], 'j')
      fill(put, ht + 8, [11, 12, 19, 20], 'j')
      put(ht + 5, 27, 'T')
      put(ht + 6, 27, 'T')
      fill(put, ht + 7, [26, 27, 28], 'T')
      fill(put, ht + 8, [26, 27, 28], 'T')
      put(ht + 9, 27, 'T')
      fill(put, ht + 13, [14, 15, 16, 17], 'M')
    },
  },
}
