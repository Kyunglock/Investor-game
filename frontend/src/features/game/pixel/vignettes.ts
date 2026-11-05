import type { Sex } from '../../../api/client'
import type { AgeStage, Pose, View } from './bodies'
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
  | 'park'
  | 'frugal'
  | 'crash'
  | 'surge'
  | 'recession'
  | 'layoff'
  | 'leave-home'
  | 'wedding'
  | 'zoo'
  | 'stage'
  | 'recital'
  | 'camp'
  | 'birthday'
  | 'sports'
  | 'classroom'
  | 'graduation'
  | 'new-home'

/** 그림 속 한 사람. me는 플레이어(장식·약점 표시까지), spouse·kid는 옷 색만 다른 맨 몸이다. 성별로 머리·치마가 갈린다 (decisions.md 69번). x는 16칸 몸의 왼쪽 열. */
export interface Figure {
  who: 'me' | 'spouse' | 'kid'
  sex: Sex
  stage: AgeStage
  x: number
  /** 아이의 생김새: 태어난 순서(0부터). 아이마다 옷·머리 색과 배냇머리가 다르다 (looks.ts, decisions.md 178번) */
  look?: number
  /** 등에 업은 아기. side는 아기 머리가 보이는 어깨 쪽 (decisions.md 178번) */
  carrying?: Carried
  /** 자세. 없으면 서 있다 (decisions.md 192번) */
  pose?: Pose
  /** 가슴에 안은 아기 (자세 hold) */
  holding?: Omit<Carried, 'side'>
  /** 바닥에서 띄우는 칸 수. 무대 위에 선 아이처럼 (decisions.md 192번) */
  lift?: number
  /** 보는 방향. 없으면 정면 (decisions.md 196번) */
  view?: View
}

export interface Carried {
  sex: Sex
  look: number
  side: 'left' | 'right'
}

/** 배우자는 옷·머리 색만 바꿔 플레이어와 구분한다. 명암 단계(윤곽·그림자·기본·밝은 쪽)까지 함께 바꾼다 (decisions.md 142번). 아이는 looks.ts의 KID_LOOKS. */
export const SPOUSE_RECOLOR: Record<string, string> = {
  // 분홍 옷, 조금 더 짙은 머리
  q: '#5a2a38',
  d: '#8e4a5c',
  c: '#b5657a',
  C: '#d0889b',
  j: '#2e1a12',
  h: '#4a2d22',
  H: '#6b4434',
  i: '#8a6048',
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

/** 풍선: 3×3 몸, 왼쪽 위 반짝임, 아래로 늘어진 줄 */
function balloon(c: Canvas, x: number, y: number, ch: string, string = 5) {
  rect(c, x, y, 3, 3, ch)
  dots(c, 'W', [[x, y]])
  rect(c, x + 1, y + 3, 1, string, 'k')
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
  // 아기 탄생: 아기 침대 옆, 하트가 떠 있다. 아기는 부모 품에 안겨 있으니 침대는 비어 있다 (decisions.md 192번).
  baby: build((c) => {
    room(c)
    window(c, 4, 4, 10, 7)
    rect(c, 40, 8, 18, 9, 'T')
    rect(c, 41, 9, 16, 7, 'F')
    for (let x = 42; x < 57; x += 2) {
      rect(c, x, 9, 1, 7, 'T')
    }
    rect(c, 41, 14, 16, 2, 'o')
    rect(c, 43, 13, 6, 1, 'W')
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
  // 놀이동산: 관람차와 풍선, 잔디 (decisions.md 87번).
  park: build((c) => {
    sky(c, 16)
    // 관람차: 바퀴 테두리와 살, 곤돌라.
    const cx = 46
    const cy = 8
    const ring: [number, number][] = []
    for (let t = 0; t < 32; t++) {
      const a = (t / 32) * Math.PI * 2
      ring.push([Math.round(cx + Math.cos(a) * 7), Math.round(cy + Math.sin(a) * 6)])
    }
    dots(c, 'K', ring)
    dots(c, 'K', [
      [cx, cy - 5],
      [cx, cy - 3],
      [cx, cy + 3],
      [cx, cy + 5],
      [cx - 5, cy],
      [cx - 3, cy],
      [cx + 3, cy],
      [cx + 5, cy],
      [cx, cy],
    ])
    dots(c, 'R', [
      [cx, cy - 7],
      [cx + 7, cy],
      [cx, cy + 7],
      [cx - 7, cy],
    ])
    dots(c, 'y', [
      [cx + 5, cy - 4],
      [cx - 5, cy - 4],
      [cx + 5, cy + 4],
      [cx - 5, cy + 4],
    ])
    rect(c, cx - 2, cy + 7, 1, 9, 'd')
    rect(c, cx + 2, cy + 7, 1, 9, 'd')
    // 풍선 셋과 줄.
    dots(c, 'R', [
      [8, 3],
      [9, 3],
      [8, 4],
      [9, 4],
    ])
    dots(c, 'B', [
      [12, 2],
      [13, 2],
      [12, 3],
      [13, 3],
    ])
    dots(c, 'y', [
      [10, 5],
      [11, 5],
      [10, 6],
      [11, 6],
    ])
    rect(c, 9, 5, 1, 4, 'k')
    rect(c, 13, 4, 1, 5, 'k')
    rect(c, 11, 7, 1, 2, 'k')
    rect(c, 0, 16, SCENE_WIDTH, 4, 'Q')
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
  // 불황: 잿빛 하늘, 셔터 내린 상점가와 "임대" 종이, 내리꽂히는 시세판 (decisions.md 139번).
  recession: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'H')
    rect(c, 2, 1, 18, 3, 'C')
    rect(c, 38, 0, 22, 3, 'C')
    // 상점 두 칸: 셔터(가로줄)와 종이.
    rect(c, 2, 6, 22, 11, 'M')
    rect(c, 1, 5, 24, 1, 'X')
    for (let y = 8; y < 17; y += 2) {
      rect(c, 4, y, 18, 1, 'N')
    }
    rect(c, 10, 9, 6, 4, 'W')
    rect(c, 11, 10, 4, 1, 'R')
    rect(c, 11, 12, 4, 1, 'N')
    // 길 건너 시세판: 파랗게 내린다.
    board(c, 40, false)
    street(c)
  }),
  // 실직: 빈 책상 위 짐 상자, 벽의 비구름, 열린 문 (decisions.md 139번).
  layoff: build((c) => {
    room(c)
    rect(c, 0, 0, SCENE_WIDTH, 2, 'C')
    rect(c, 18, 13, 18, 1, 'T')
    rect(c, 19, 14, 1, 3, 'T')
    rect(c, 34, 14, 1, 3, 'T')
    // 짐 상자: 갈색에 노란 테이프, 삐죽 나온 화분.
    rect(c, 22, 8, 10, 5, 'd')
    rect(c, 26, 8, 2, 5, 'y')
    rect(c, 23, 6, 3, 2, 'g')
    rect(c, 24, 8, 1, 1, 'P')
    // 열린 문과 그 밖의 빛.
    rect(c, 50, 4, 8, 13, 'V')
    rect(c, 52, 5, 5, 12, 'L')
    dots(c, 'B', [
      [6, 5],
      [9, 6],
      [12, 5],
      [7, 8],
      [11, 9],
    ])
  }),
  // 자녀 독립: 집 현관 앞, 짐가방과 길, 떠나는 아이 (decisions.md 139번).
  'leave-home': build((c) => {
    sky(c, 12)
    rect(c, 0, 12, SCENE_WIDTH, 5, 'Q')
    // 집: 벽, 지붕, 문, 창.
    rect(c, 2, 4, 26, 13, 'F')
    rect(c, 1, 3, 28, 1, 'X')
    rect(c, 3, 2, 24, 1, 'X')
    rect(c, 6, 9, 5, 8, 'V')
    rect(c, 10, 12, 1, 1, 'y')
    window(c, 16, 6, 8, 5)
    // 길과 짐가방.
    rect(c, 28, 15, 36, 2, 'A')
    rect(c, 50, 13, 6, 4, 'd')
    rect(c, 52, 12, 2, 1, 'd')
    rect(c, 51, 14, 4, 1, 'y')
    street(c)
  }),
  // 자녀 결혼: 흰 아치와 꽃, 하트 (decisions.md 139번).
  wedding: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'F')
    rect(c, 0, 0, SCENE_WIDTH, 2, 'H')
    rect(c, 0, 17, SCENE_WIDTH, 3, 'R')
    // 아치: 기둥 둘과 둥근 위.
    rect(c, 38, 4, 2, 13, 'W')
    rect(c, 56, 4, 2, 13, 'W')
    rect(c, 40, 3, 16, 1, 'W')
    rect(c, 42, 2, 12, 1, 'W')
    // 꽃: 기둥에 감긴 빨강·노랑.
    dots(c, 'R', [
      [38, 6],
      [57, 8],
      [39, 10],
      [56, 12],
      [44, 2],
      [51, 2],
    ])
    dots(c, 'y', [
      [39, 7],
      [56, 9],
      [38, 12],
      [57, 14],
      [47, 2],
    ])
    dots(c, 'g', [
      [38, 8],
      [57, 10],
      [39, 13],
    ])
    heart(c, 10, 2)
    heart(c, 24, 4)
    heart(c, 60, 6)
  }),
  // 동물원: 나무 울타리 너머 기린 한 마리 (decisions.md 192번).
  zoo: build((c) => {
    sky(c, 17)
    rect(c, 0, 13, SCENE_WIDTH, 4, 'Q')
    // 기린: 몸통, 다리, 긴 목, 머리, 뿔, 무늬
    rect(c, 44, 7, 12, 5, 'y')
    for (const x of [45, 48, 52, 55]) {
      rect(c, x, 12, 1, 5, 'y')
    }
    rect(c, 52, 1, 3, 7, 'y')
    rect(c, 52, 0, 6, 3, 'y')
    dots(c, 'd', [
      [53, 0],
      [55, 0],
      [57, 1],
      [46, 8],
      [49, 9],
      [52, 8],
      [47, 10],
      [54, 10],
      [53, 3],
      [53, 5],
    ])
    dots(c, 'e', [[56, 1]])
    // 나무 울타리
    rect(c, 0, 13, SCENE_WIDTH, 1, 'T')
    rect(c, 0, 15, SCENE_WIDTH, 1, 'T')
    for (let x = 1; x < SCENE_WIDTH; x += 6) {
      rect(c, x, 12, 1, 5, 'd')
    }
    rect(c, 0, 17, SCENE_WIDTH, 3, 'I')
  }),
  // 학예회: 붉은 막, 조명이 비추는 무대 (decisions.md 192번).
  stage: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 20, 'K')
    rect(c, 0, 0, SCENE_WIDTH, 2, 'U')
    rect(c, 0, 0, 7, 15, 'U')
    rect(c, 57, 0, 7, 15, 'U')
    for (const x of [2, 5, 59, 62]) {
      rect(c, x, 2, 1, 13, 'R')
    }
    // 조명 빛
    rect(c, 22, 2, 20, 12, 'N')
    rect(c, 26, 2, 12, 12, 'H')
    rect(c, 7, 14, 50, 3, 'T')
    rect(c, 7, 14, 50, 1, 'J')
    dots(c, 'L', [
      [12, 4],
      [50, 6],
      [16, 9],
      [46, 3],
    ])
    rect(c, 0, 17, SCENE_WIDTH, 3, 'D')
  }),
  // 피아노 발표회: 무대 오른쪽에 검은 피아노 (decisions.md 192번).
  recital: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 20, 'K')
    rect(c, 0, 0, SCENE_WIDTH, 2, 'U')
    rect(c, 0, 0, 5, 15, 'U')
    rect(c, 59, 0, 5, 15, 'U')
    rect(c, 18, 2, 24, 12, 'N')
    rect(c, 7, 14, 50, 3, 'T')
    rect(c, 7, 14, 50, 1, 'J')
    // 그랜드 피아노: 몸통, 뚜껑, 건반, 다리
    rect(c, 40, 7, 16, 4, 'e')
    rect(c, 42, 3, 12, 1, 'e')
    rect(c, 44, 4, 1, 3, 'e')
    rect(c, 40, 10, 8, 1, 'W')
    dots(c, 'e', [
      [41, 10],
      [43, 10],
      [45, 10],
    ])
    rect(c, 41, 11, 1, 3, 'e')
    rect(c, 54, 11, 1, 3, 'e')
    rect(c, 0, 17, SCENE_WIDTH, 3, 'D')
  }),
  // 캠핑: 밤하늘의 별, 텐트, 모닥불 (decisions.md 192번).
  camp: build((c) => {
    rect(c, 0, 0, SCENE_WIDTH, 17, 'p')
    dots(c, 'W', [
      [6, 2],
      [15, 5],
      [23, 1],
      [31, 4],
      [38, 2],
      [44, 6],
      [52, 1],
      [60, 4],
      [11, 8],
      [35, 9],
    ])
    rect(c, 56, 1, 3, 3, 'L')
    rect(c, 57, 1, 2, 2, 'p')
    // 텐트: 노란 삼각형과 어두운 입구
    for (let i = 0; i < 9; i++) {
      rect(c, 46 - i, 8 + i, 2 + i * 2, 1, 'y')
    }
    for (let i = 0; i < 5; i++) {
      rect(c, 46 - Math.floor(i / 2), 12 + i, 2 + Math.floor(i / 2) * 2, 1, 'K')
    }
    rect(c, 0, 17, SCENE_WIDTH, 3, 'Q')
    // 모닥불: 장작과 불꽃
    rect(c, 28, 16, 6, 1, 'd')
    rect(c, 29, 13, 4, 3, 'R')
    rect(c, 30, 11, 2, 3, 'L')
    dots(c, 'L', [[31, 10]])
  }),
  // 생일 파티: 고깔 줄, 풍선, 촛불 켠 케이크 (decisions.md 192번).
  birthday: build((c) => {
    room(c)
    for (let x = 2; x < SCENE_WIDTH; x += 6) {
      const ch = ['R', 'B', 'y'][((x / 6) % 3) | 0]
      rect(c, x, 1, 4, 1, ch)
      rect(c, x + 1, 2, 2, 1, ch)
    }
    rect(c, 0, 0, SCENE_WIDTH, 1, 'N')
    balloon(c, 3, 4, 'R', 6)
    balloon(c, 7, 5, 'y', 5)
    balloon(c, 55, 4, 'B', 6)
    balloon(c, 59, 5, 'R', 5)
    // 탁자와 케이크
    rect(c, 22, 13, 20, 1, 'T')
    rect(c, 24, 14, 1, 3, 'T')
    rect(c, 39, 14, 1, 3, 'T')
    rect(c, 26, 9, 12, 4, 'W')
    rect(c, 26, 11, 12, 1, 'R')
    for (const x of [28, 31, 34]) {
      rect(c, x, 7, 1, 2, 'y')
      dots(c, 'L', [[x, 6]])
    }
  }),
  // 운동회: 만국기 줄, 흙 운동장의 하얀 선 (decisions.md 192번).
  sports: build((c) => {
    sky(c, 12)
    rect(c, 40, 4, 22, 8, 'M')
    windows(c, 42, 5, 5, 2)
    rect(c, 0, 12, SCENE_WIDTH, 8, 'I')
    rect(c, 0, 14, SCENE_WIDTH, 1, 'W')
    rect(c, 0, 18, SCENE_WIDTH, 1, 'W')
    for (let x = 0; x < SCENE_WIDTH; x += 4) {
      const ch = ['R', 'B', 'y', 'g'][((x / 4) % 4) | 0]
      const y = 2 + Math.round(Math.sin(x / 10) * 1)
      rect(c, x, y, 3, 1, ch)
      rect(c, x + 1, y + 1, 1, 1, ch)
    }
  }),
  // 공개 수업: 칠판과 책상, 벽시계 (decisions.md 192번).
  classroom: build((c) => {
    room(c)
    rect(c, 10, 2, 32, 10, 'T')
    rect(c, 11, 3, 30, 8, 'c')
    rect(c, 14, 5, 8, 1, 'W')
    rect(c, 14, 7, 12, 1, 'W')
    rect(c, 28, 5, 6, 1, 'W')
    rect(c, 11, 11, 30, 1, 'N')
    rect(c, 50, 3, 5, 5, 'W')
    dots(c, 'e', [
      [52, 4],
      [52, 5],
      [53, 5],
    ])
    rect(c, 46, 13, 14, 1, 'T')
    rect(c, 47, 14, 1, 3, 'T')
    rect(c, 58, 14, 1, 3, 'T')
  }),
  // 졸업식: 학교 앞, 꽃다발과 하얀 현수막 (decisions.md 192번).
  graduation: build((c) => {
    sky(c, 17)
    rect(c, 20, 3, 44, 14, 'M')
    rect(c, 19, 2, 46, 1, 'X')
    windows(c, 24, 5, 9, 3)
    rect(c, 26, 13, 30, 2, 'W')
    rect(c, 26, 13, 30, 1, 'N')
    rect(c, 0, 17, SCENE_WIDTH, 3, 'A')
    // 꽃다발
    dots(c, 'R', [
      [6, 12],
      [7, 11],
      [8, 12],
    ])
    dots(c, 'y', [
      [7, 12],
      [9, 11],
    ])
    rect(c, 7, 13, 1, 4, 'g')
  }),
  // 새집 장만: 아파트 앞 리본 맨 입구와 이삿짐 상자, 풍선 (decisions.md 192번).
  'new-home': build((c) => {
    sky(c, 17)
    rect(c, 30, 1, 20, 16, 'M')
    windows(c, 32, 2, 5, 4)
    rect(c, 37, 12, 6, 5, 'N')
    rect(c, 38, 13, 4, 4, 'V')
    rect(c, 35, 11, 10, 1, 'R')
    dots(c, 'R', [
      [39, 10],
      [41, 10],
      [40, 12],
    ])
    rect(c, 52, 13, 5, 4, 'O')
    rect(c, 54, 10, 4, 3, 'O')
    rect(c, 52, 14, 5, 1, 'P')
    balloon(c, 59, 2, 'R', 8)
    balloon(c, 55, 4, 'y', 6)
    rect(c, 0, 15, 28, 2, 'Q')
    street(c)
  }),
}
