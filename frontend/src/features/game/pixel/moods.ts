import type { Layer, Put } from './sprite'

/**
 * 표정 네 가지 (decisions.md 62번). 얼굴 좌표는 bodies.ts 주석을 따른다(머리 윗줄 ht 기준).
 * 장식·약점 표시 위에 마지막으로 포개므로 안경 같은 장식과 겹치면 표정이 이긴다.
 */
export type MoodKey = 'joy' | 'confident' | 'despair' | 'frugal'

/** 같은 글자를 여러 칸에 */
export function fill(put: Put, y: number, xs: number[], ch: string) {
  for (const x of xs) {
    put(y, x, ch)
  }
}

/** 원래 눈(3×3 눈동자와 반사)을 지운다 */
export function clearEyes(put: Put, ht: number) {
  for (const dy of [12, 13, 14, 15]) {
    fill(put, ht + dy, [9, 10, 11, 12, 13, 18, 19, 20, 21, 22], 's')
  }
}

export const MOODS: Record<MoodKey, Layer> = {
  // 기쁨: 웃는 눈(^ ^), 혀가 보이게 벌린 입, 진한 볼 홍조
  joy: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(put, ht + 12, [10, 11, 12, 19, 20, 21], 'k')
      fill(put, ht + 13, [9, 13, 18, 22], 'k')
      fill(put, ht + 15, [8, 9, 22, 23], 'r')
      fill(put, ht + 16, [8, 9, 10, 21, 22, 23], 'r')
      fill(put, ht + 16, [14, 17], 'm')
      fill(put, ht + 16, [15, 16], 'M')
      fill(put, ht + 17, [14, 17], 's')
      fill(put, ht + 17, [15, 16], 'r')
    },
  },
  // 자신감: 반짝이는 선글라스, 한쪽만 올라간 입
  confident: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(
        put,
        ht + 12,
        Array.from({ length: 18 }, (_, i) => 7 + i),
        'k',
      )
      for (const dy of [13, 14]) {
        fill(put, ht + dy, [9, 10, 11, 12, 13, 18, 19, 20, 21, 22], 'K')
      }
      fill(put, ht + 15, [10, 11, 12, 19, 20, 21], 'K')
      put(ht + 13, 10, 'W')
      put(ht + 14, 11, 'W')
      put(ht + 13, 19, 'W')
      put(ht + 14, 20, 'W')
      put(ht + 17, 15, 's')
      fill(put, ht + 17, [16, 17], 'm')
      put(ht + 16, 18, 'm')
    },
  },
  // 좌절: 반짝임이 아래로 내려간 그렁그렁한 눈, 흐르는 눈물, 처진 입
  despair: {
    paint: (put, ht) => {
      fill(put, ht + 13, [10, 19], 'k')
      fill(put, ht + 14, [11, 20], 'E')
      for (const dy of [15, 16, 17]) {
        fill(put, ht + dy, [10, 21], 'T')
      }
      fill(put, ht + 17, [14, 15, 16, 17], 'm')
      fill(put, ht + 18, [14, 17], 'm')
    },
  },
  // 근심(긴축): 반쯤 감은 눈, 관자놀이 식은땀, 꾹 다문 입
  frugal: {
    paint: (put, ht) => {
      clearEyes(put, ht)
      fill(put, ht + 13, [9, 10, 11, 12, 19, 20, 21, 22], 'k')
      fill(put, ht + 14, [10, 11, 12, 19, 20, 21], 'e')
      put(ht + 14, 11, 'k')
      put(ht + 14, 20, 'k')
      fill(put, ht + 15, [10, 11, 12, 19, 20, 21], 'f')
      put(ht + 11, 24, 'T')
      put(ht + 12, 24, 'T')
      fill(put, ht + 13, [23, 24, 25], 'T')
      fill(put, ht + 14, [23, 24, 25], 'T')
      put(ht + 15, 24, 'T')
      put(ht + 13, 23, 'W')
      fill(put, ht + 17, [14, 15, 16, 17], 'M')
    },
  },
}

/** 감은 눈꺼풀. 평소 얼굴일 때만 잠깐 덮어 깜빡이게 한다. */
export const EYELIDS: Layer = {
  paint: (put, ht) => {
    for (const dy of [12, 13, 15]) {
      fill(put, ht + dy, [10, 11, 12, 19, 20, 21], 's')
    }
    fill(put, ht + 14, [10, 11, 12, 19, 20, 21], 'k')
  },
}
