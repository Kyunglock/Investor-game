import type { AgeStage } from './bodies'
import { build, type Canvas, dots, plant, rect, SCENE_WIDTH, SCENES, sky, window } from './scenes'
import type { PixelMap } from './sprite'

/**
 * 엔딩 크레딧의 장(章) 그림 (#23). 진행 화면의 장면(64×20)을 그대로 쓰거나 새로 그린 배경 위에 여러 사람을 세운다. 사람의 발은 맨 아랫줄에 닿는다.
 */
export type VignetteKey =
  | 'nursery'
  | 'office'
  | 'studio'
  | 'street'
  | 'home-old'
  | 'family'
  | 'oneroom'
  | 'villa'
  | 'apartment'
  | 'rain'

/** 그림 속 한 사람. me는 플레이어(장식·약점 표시까지), spouse·kid는 옷 색만 다른 맨 몸이다. x는 16칸 몸의 왼쪽 열. */
export interface Figure {
  who: 'me' | 'spouse' | 'kid'
  stage: AgeStage
  x: number
}

export interface CreditArt {
  vignette: VignetteKey
  figures: Figure[]
}

/** 아파트·빌라 외벽의 창 격자 */
function windows(c: Canvas, x: number, y: number, cols: number, rows: number, gap = 4) {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      rect(c, x + i * gap, y + j * 3, 2, 2, 'S')
    }
  }
}

function street(c: Canvas) {
  rect(c, 0, 17, SCENE_WIDTH, 1, 'D')
  rect(c, 0, 18, SCENE_WIDTH, 2, 'A')
}

export const VIGNETTES: Record<VignetteKey, PixelMap> = {
  nursery: SCENES.nursery.map,
  office: SCENES.office.map,
  studio: SCENES.studio.map,
  street: SCENES.street.map,
  'home-old': SCENES['home-old'].map,
  // 거실: 액자, 창, 화분, 벽의 하트.
  family: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'F')
    rect(c, 0, 0, SCENE_WIDTH, 2, 'H')
    rect(c, 0, 17, SCENE_WIDTH, 3, 'D')
    window(c, 42, 3, 12, 8)
    rect(c, 4, 4, 8, 6, 'N')
    rect(c, 5, 5, 6, 4, 'Q')
    rect(c, 5, 7, 6, 2, 'g')
    plant(c, 58)
    dots(c, 'R', [
      [58, 1],
      [59, 1],
      [61, 1],
      [62, 1],
      [57, 2],
      [58, 2],
      [59, 2],
      [60, 2],
      [61, 2],
      [62, 2],
      [63, 2],
      [58, 3],
      [59, 3],
      [60, 3],
      [61, 3],
      [62, 3],
      [59, 4],
      [60, 4],
      [61, 4],
      [60, 5],
    ])
  }),
  // 좁고 높은 원룸 건물, 작은 창이 촘촘하다.
  oneroom: build((c) => {
    sky(c, 17)
    rect(c, 30, 2, 18, 15, 'M')
    rect(c, 29, 1, 20, 1, 'N')
    windows(c, 32, 4, 4, 4)
    rect(c, 37, 14, 4, 3, 'V')
    rect(c, 52, 8, 10, 9, 'F')
    windows(c, 54, 10, 2, 2)
    street(c)
  }),
  // 3층 빌라: 붉은 벽돌, 낮고 넓다.
  villa: build((c) => {
    sky(c, 17)
    rect(c, 26, 6, 32, 11, 'P')
    rect(c, 25, 5, 34, 1, 'X')
    windows(c, 28, 7, 7, 3)
    rect(c, 40, 14, 4, 3, 'V')
    street(c)
  }),
  // 아파트 단지: 높은 동 두 채.
  apartment: build((c) => {
    sky(c, 17)
    rect(c, 24, 1, 16, 16, 'M')
    rect(c, 44, 3, 16, 14, 'F')
    windows(c, 26, 2, 4, 5)
    windows(c, 46, 4, 4, 4)
    rect(c, 0, 15, 22, 2, 'Q')
    street(c)
  }),
  // 비 오는 거리: 먹구름과 빗줄기.
  rain: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'H')
    rect(c, 6, 1, 20, 3, 'C')
    rect(c, 34, 0, 24, 3, 'C')
    for (let x = 3; x < SCENE_WIDTH; x += 5) {
      for (let y = 5 + (x % 3); y < 16; y += 4) {
        rect(c, x, y, 1, 2, 'B')
      }
    }
    rect(c, 40, 8, 10, 9, 'M')
    street(c)
  }),
}
