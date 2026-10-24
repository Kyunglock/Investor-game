import type { AgeStage } from './bodies'
import {
  build,
  type Canvas,
  dots,
  plant,
  rect,
  room,
  SCENE_WIDTH,
  SCENES,
  sky,
  window,
} from './scenes'
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
  | 'baby'
  | 'trip'
  | 'frugal'
  | 'crash'
  | 'surge'

/** 그림 속 한 사람. me는 플레이어(장식·약점 표시까지), spouse·kid는 옷 색만 다른 맨 몸이다. x는 16칸 몸의 왼쪽 열. */
export interface Figure {
  who: 'me' | 'spouse' | 'kid'
  stage: AgeStage
  x: number
}

/** 배우자와 아이는 옷·머리 색만 바꿔 플레이어와 구분한다. */
export const RECOLOR: Record<Exclude<Figure['who'], 'me'>, Record<string, string>> = {
  spouse: { c: '#b5657a', h: '#5a3a2e' },
  kid: { c: '#e3b53a', p: '#4f8fd6' },
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

/** 작은 하트 */
function heart(c: Canvas, x: number, y: number) {
  const pts: [number, number][] = []
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [3, 0],
    [4, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 4],
  ]) {
    pts.push([x + dx, y + dy])
  }
  dots(c, 'R', pts)
}

/** 시세판 모니터. up이면 오르는 선, 아니면 내리는 선 */
function board(c: Canvas, x: number, up: boolean) {
  rect(c, x, 5, 14, 8, 'K')
  rect(c, x + 1, 6, 12, 6, 'Z')
  const ys = up ? [11, 10, 10, 9, 9, 8, 8, 7, 7, 6] : [6, 7, 7, 8, 8, 9, 10, 10, 11, 11]
  dots(
    c,
    up ? 'U' : 'B',
    ys.map((y, i) => [x + 2 + i, y] as [number, number]),
  )
  rect(c, x + 6, 13, 2, 1, 'K')
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
  // 아기 탄생: 아기 침대 옆, 하트가 떠 있다.
  baby: build((c) => {
    room(c)
    window(c, 4, 4, 10, 7)
    rect(c, 40, 8, 18, 9, 'T')
    rect(c, 41, 9, 16, 7, 'F')
    for (let x = 42; x < 57; x += 2) {
      rect(c, x, 9, 1, 7, 'T')
    }
    rect(c, 41, 14, 16, 2, 'o')
    rect(c, 46, 11, 4, 3, 's')
    dots(c, 'e', [
      [47, 12],
      [49, 12],
    ])
    heart(c, 18, 2)
    heart(c, 60, 3)
    heart(c, 36, 1)
  }),
  // 가족 여행: 바다, 모래, 파라솔.
  trip: build((c) => {
    sky(c, 11)
    rect(c, 0, 11, SCENE_WIDTH, 4, 'B')
    for (let x = 1; x < SCENE_WIDTH; x += 7) {
      rect(c, x, 12, 3, 1, 'W')
    }
    rect(c, 0, 15, SCENE_WIDTH, 5, 'I')
    rect(c, 46, 3, 12, 1, 'r')
    rect(c, 45, 4, 14, 1, 'r')
    rect(c, 47, 5, 10, 1, 'W')
    rect(c, 51, 6, 2, 10, 'd')
    rect(c, 44, 16, 16, 2, 'y')
  }),
  // 긴축: 불 꺼진 방, 책상 위 라면 한 그릇, 벽의 고지서.
  frugal: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'H')
    rect(c, 0, 0, SCENE_WIDTH, 2, 'V')
    rect(c, 0, 17, SCENE_WIDTH, 3, 'D')
    rect(c, 6, 4, 10, 7, 'N')
    rect(c, 7, 5, 8, 5, 'V')
    rect(c, 18, 13, 16, 1, 'T')
    rect(c, 19, 14, 1, 3, 'T')
    rect(c, 32, 14, 1, 3, 'T')
    rect(c, 23, 11, 6, 2, 'W')
    rect(c, 24, 10, 4, 1, 'y')
    dots(c, 'C', [
      [24, 8],
      [26, 7],
      [27, 8],
    ])
    rect(c, 55, 5, 6, 8, 'W')
    rect(c, 56, 7, 4, 1, 'R')
    rect(c, 56, 9, 4, 1, 'N')
    rect(c, 56, 11, 4, 1, 'N')
  }),
  // 급락: 시세판이 파랗게 내리꽂히고 비구름이 떴다.
  crash: build((c) => {
    room(c)
    rect(c, 0, 0, SCENE_WIDTH, 2, 'C')
    rect(c, 18, 13, 18, 1, 'T')
    rect(c, 19, 14, 1, 3, 'T')
    rect(c, 34, 14, 1, 3, 'T')
    board(c, 20, false)
    rect(c, 50, 2, 10, 2, 'C')
    dots(c, 'B', [
      [51, 5],
      [54, 6],
      [57, 5],
      [52, 8],
      [56, 9],
    ])
  }),
  // 급등: 시세판이 빨갛게 치솟고 반짝인다.
  surge: build((c) => {
    room(c)
    rect(c, 18, 13, 18, 1, 'T')
    rect(c, 19, 14, 1, 3, 'T')
    rect(c, 34, 14, 1, 3, 'T')
    board(c, 20, true)
    dots(c, 'L', [
      [50, 3],
      [49, 4],
      [51, 4],
      [50, 5],
      [58, 6],
      [57, 7],
      [59, 7],
      [58, 8],
      [54, 10],
      [53, 11],
      [55, 11],
      [54, 12],
    ])
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
