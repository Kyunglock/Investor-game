import type { Game, Phase } from '../../../api/client'
import type { AgeStage } from './bodies'
import type { PixelMap } from './sprite'

/**
 * 가운데 카드의 도트 장면 (설계 8절). 64열 × 20행. 캐릭터 전신(16×20)은 anchor.x 열에, 바닥에 발을 붙여 놓는다.
 * 지도는 겹겹이 칠해서 만든다. 손으로 찍은 문자열보다 고치기 쉽다.
 */
export type SceneKey =
  | 'nursery'
  | 'school'
  | 'street'
  | 'office'
  | 'studio'
  | 'studio-middle'
  | 'home-old'

export interface Scene {
  map: PixelMap
  /** {집}은 사는 곳(자산·가족에 따라 원룸에서 펜트하우스까지)으로, {활동}은 직장 여부에 따른 문구로 바꿔 보여 준다 (sceneCaption) */
  caption: string
  /** 캐릭터의 왼쪽 위 열과 발이 닿는 행 */
  anchor: { x: number; y: number }
}

export const SCENE_WIDTH = 64
export const SCENE_HEIGHT = 20

export function sceneFor(stage: AgeStage, phase: Phase, hasJob: boolean): SceneKey {
  if (stage === 'baby') {
    return 'nursery'
  }
  if (stage === 'child') {
    return 'school'
  }
  if (stage === 'old' || phase === 'ENDED') {
    return 'home-old'
  }
  if (stage === 'middle') {
    return 'studio-middle'
  }
  if (!hasJob) {
    return 'street'
  }
  return phase === 'INVESTING' ? 'studio' : 'office'
}

/** 사는 곳. 실제로 고른 거주 형태를 따른다(주거 설계): 수십억이 있어도 월세를 고르면 월세다. */
export function dwellingFor(home: {
  tenure: Game['housing']['tenure']
  regionName?: string | null
  married: boolean
  children: number
}): string {
  const family = home.married || home.children > 0
  switch (home.tenure) {
    case 'PARENTS':
      return '부모님 집'
    case 'MONTHLY':
      return family ? '투룸 월세' : '원룸 월세'
    case 'VILLA_JEONSE':
      return '빌라 전세'
    case 'APT_JEONSE':
      return '아파트 전세'
    case 'OWN':
      return '내 집 (아파트)'
  }
}

/** 장면 문구. 사는 곳을 채우고, 전업투자자에게는 "퇴근 후"가 아닌 문구를 쓴다. */
export function sceneCaption(
  key: SceneKey,
  home: {
    tenure: Game['housing']['tenure']
    regionName?: string | null
    married: boolean
    children: number
    fullTimeInvestor: boolean
  },
): string {
  const activity =
    key === 'studio' && home.fullTimeInvestor
      ? '하루 종일 시세판을 보는 중'
      : '퇴근 후 주식 앱을 켜는 중'
  // 경기 아파트에 살면 서울이 아니다.
  const inGyeonggi =
    (home.tenure === 'OWN' || home.tenure === 'APT_JEONSE') &&
    Boolean(home.regionName?.startsWith('경기'))
  return SCENES[key].caption
    .replace(/^서울 · \{집\}/, `${inGyeonggi ? '경기' : '서울'} · {집}`)
    .replace('{집}', dwellingFor(home))
    .replace('{활동}', activity)
}

// ---- 그리기 도구 (엔딩 크레딧 그림도 쓴다: vignettes.ts) ----

export type Canvas = string[][]

function canvas(fill: string): Canvas {
  return Array.from({ length: SCENE_HEIGHT }, () => Array(SCENE_WIDTH).fill(fill))
}

export function rect(c: Canvas, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (c[j] && i >= 0 && i < SCENE_WIDTH) {
        c[j][i] = ch
      }
    }
  }
}

export function dots(c: Canvas, ch: string, points: [number, number][]) {
  for (const [x, y] of points) {
    rect(c, x, y, 1, 1, ch)
  }
}

export function sky(c: Canvas, rows: number) {
  rect(c, 0, 0, SCENE_WIDTH, rows, 'S')
  rect(c, 5, 1, 3, 3, 'L')
  dots(c, 'L', [
    [4, 2],
    [8, 2],
    [6, 0],
    [6, 4],
  ])
  rect(c, 18, 3, 6, 2, 'W')
  rect(c, 20, 2, 3, 1, 'W')
  rect(c, 40, 1, 8, 2, 'W')
  rect(c, 42, 0, 4, 1, 'W')
}

/** 창틀과 그 안의 하늘 */
export function window(c: Canvas, x: number, y: number, w: number, h: number) {
  rect(c, x, y, w, h, 'N')
  rect(c, x + 1, y + 1, w - 2, h - 2, 'S')
  rect(c, x + Math.floor(w / 2), y + 1, 1, h - 2, 'N')
  rect(c, x + 1, y + Math.floor(h / 2), w - 2, 1, 'N')
}

export function room(c: Canvas) {
  rect(c, 0, 0, SCENE_WIDTH, 17, 'F')
  rect(c, 0, 0, SCENE_WIDTH, 2, 'H')
  rect(c, 0, 17, SCENE_WIDTH, 3, 'D')
}

function desk(c: Canvas, x: number, w: number) {
  rect(c, x, 13, w, 1, 'T')
  rect(c, x + 1, 14, 1, 3, 'T')
  rect(c, x + w - 2, 14, 1, 3, 'T')
}

function monitor(c: Canvas, x: number, withChart: boolean) {
  rect(c, x, 8, 9, 5, 'K')
  rect(c, x + 1, 9, 7, 3, 'Z')
  rect(c, x + 4, 12, 1, 1, 'K')
  if (withChart) {
    dots(c, 'U', [
      [x + 2, 11],
      [x + 3, 10],
      [x + 4, 11],
      [x + 5, 10],
      [x + 6, 9],
      [x + 7, 9],
    ])
  } else {
    rect(c, x + 2, 10, 5, 1, 'N')
  }
}

export function plant(c: Canvas, x: number) {
  rect(c, x, 13, 4, 4, 'P')
  rect(c, x + 1, 12, 2, 1, 'O')
  rect(c, x + 1, 9, 2, 3, 'g')
  dots(c, 'g', [
    [x, 10],
    [x + 3, 10],
    [x, 8],
    [x + 3, 8],
  ])
}

function bookshelf(c: Canvas, x: number, w: number) {
  rect(c, x, 4, w, 13, 'J')
  for (let y = 6; y < 16; y += 3) {
    rect(c, x + 1, y, w - 2, 1, 'N')
    for (let i = x + 1; i < x + w - 1; i += 2) {
      rect(c, i, y - 2, 1, 2, i % 3 === 0 ? 'r' : i % 3 === 1 ? 'c' : 'y')
    }
  }
}

const toMap = (c: Canvas): PixelMap => c.map((row) => row.join(''))

export function build(draw: (c: Canvas) => void): PixelMap {
  const c = canvas('.')
  draw(c)
  return toMap(c)
}

export const SCENES: Record<SceneKey, Scene> = {
  nursery: {
    caption: '서울 · 집 · 부모님 품에서 자라는 중',
    anchor: { x: 22, y: 20 },
    map: build((c) => {
      room(c)
      window(c, 6, 5, 10, 7)
      // 아기 침대
      rect(c, 40, 7, 20, 10, 'T')
      rect(c, 41, 8, 18, 8, 'F')
      for (let x = 42; x < 59; x += 2) {
        rect(c, x, 8, 1, 8, 'T')
      }
      rect(c, 41, 14, 18, 2, 'o')
      // 모빌
      rect(c, 49, 2, 1, 4, 'N')
      dots(c, 'y', [[48, 6]])
      dots(c, 'r', [[50, 6]])
    }),
  },
  school: {
    caption: '서울 · 학교 · 친구들과 뛰노는 중',
    anchor: { x: 10, y: 20 },
    map: build((c) => {
      sky(c, 14)
      // 학교 건물
      rect(c, 34, 4, 28, 10, 'M')
      rect(c, 33, 3, 30, 1, 'X')
      rect(c, 36, 2, 24, 1, 'X')
      for (let x = 37; x < 60; x += 6) {
        window(c, x, 6, 4, 3)
        window(c, x, 10, 4, 3)
      }
      rect(c, 46, 10, 4, 4, 'V')
      // 운동장
      rect(c, 0, 13, SCENE_WIDTH, 1, 'Q')
      rect(c, 0, 14, SCENE_WIDTH, 6, 'I')
      rect(c, 0, 19, SCENE_WIDTH, 1, 'D')
      // 축구 골대
      rect(c, 26, 9, 1, 5, 'W')
      rect(c, 26, 9, 6, 1, 'W')
      rect(c, 31, 9, 1, 5, 'W')
    }),
  },
  street: {
    caption: '서울 · 동네 길 · 일자리를 찾는 중',
    anchor: { x: 18, y: 20 },
    map: build((c) => {
      sky(c, 15)
      rect(c, 0, 6, SCENE_WIDTH, 2, 'H')
      rect(c, 0, 8, SCENE_WIDTH, 7, 'Q')
      // 건물들
      rect(c, 36, 5, 10, 10, 'M')
      rect(c, 48, 7, 8, 8, 'F')
      window(c, 38, 7, 3, 3)
      window(c, 42, 7, 3, 3)
      window(c, 50, 9, 4, 3)
      // 전봇대
      rect(c, 58, 2, 1, 13, 'V')
      rect(c, 55, 3, 7, 1, 'V')
      // 인도와 길
      rect(c, 0, 15, SCENE_WIDTH, 1, 'D')
      rect(c, 0, 16, SCENE_WIDTH, 4, 'A')
      for (let x = 2; x < SCENE_WIDTH; x += 8) {
        rect(c, x, 18, 4, 1, 'W')
      }
    }),
  },
  office: {
    caption: '서울 · 사무실 · 월급을 모으는 중',
    anchor: { x: 38, y: 20 },
    map: build((c) => {
      room(c)
      window(c, 44, 3, 14, 7)
      rect(c, 2, 4, 12, 13, 'J')
      rect(c, 3, 5, 10, 1, 'N')
      rect(c, 3, 9, 10, 1, 'N')
      rect(c, 3, 13, 10, 1, 'N')
      desk(c, 18, 20)
      monitor(c, 23, false)
      rect(c, 19, 12, 3, 1, 'W')
    }),
  },
  studio: {
    caption: '서울 · {집} · {활동}',
    anchor: { x: 36, y: 20 },
    map: build((c) => {
      room(c)
      window(c, 6, 4, 10, 7)
      desk(c, 18, 18)
      monitor(c, 22, true)
      plant(c, 56)
      rect(c, 46, 6, 8, 5, 'N')
      rect(c, 47, 7, 6, 3, 'S')
    }),
  },
  'studio-middle': {
    caption: '서울 · {집} · 오랜 투자를 이어 가는 중',
    anchor: { x: 36, y: 20 },
    map: build((c) => {
      room(c)
      bookshelf(c, 3, 12)
      desk(c, 18, 18)
      monitor(c, 22, true)
      plant(c, 56)
      plant(c, 51)
      rect(c, 46, 4, 8, 5, 'N')
      rect(c, 47, 5, 6, 3, 'S')
    }),
  },
  'home-old': {
    caption: '서울 · {집} · 창가에서 지난날을 돌아보는 중',
    anchor: { x: 28, y: 20 },
    map: build((c) => {
      room(c)
      window(c, 6, 3, 18, 10)
      // 안락의자
      rect(c, 46, 9, 2, 8, 'T')
      rect(c, 46, 11, 12, 6, 'r')
      rect(c, 48, 9, 8, 2, 'r')
      rect(c, 56, 9, 2, 8, 'T')
      plant(c, 2)
    }),
  },
}
