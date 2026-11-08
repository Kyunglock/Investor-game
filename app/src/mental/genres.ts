import type { Company } from '@web/api/client'

export type Genre = NonNullable<Company['mental']>['genre']

/**
 * 장르 둘 (decisions.md 328·329·331·332번): 그 분기 이벤트가 정한다. 플레이어는 고르지 않는다. 적은 둘 다 위에서 내려오고, 플레이어는 둘 다 아래에
 * 붙박이로 서서 누른 쪽을 쏜다(걷지 않는다).
 */
export interface GenreSpec {
  name: string
  hint: string
  /** 적이 노리는 것. 두 장르 다 멘탈벽이다: 벽 없는 판은 사장냥이 바로 맞아 버그처럼 보였다. 장르는 바닥·소품 분위기만 가른다. */
  target: 'player' | 'wall'
}

export const GENRES: Record<Genre, GenreSpec> = {
  ASSAULT: {
    name: '공격',
    hint: '적이 숲을 지나 멘탈벽으로 내려온다. 벽 뒤에서 누른 쪽을 쏴라',
    target: 'wall',
  },
  DEFENSE: {
    name: '디펜스',
    hint: '적이 멘탈벽으로 몰려온다. 벽 뒤에서 누른 쪽을 쏴라',
    target: 'wall',
  },
}

/** 한 판의 길이(초): 2분 (decisions.md 363번, 330번의 4분은 너무 길었다). 레벨이 예닐곱 번 오를 길이. */
export const BATTLE_SECONDS = 120

/**
 * 난이도 곡선의 빠르기: 적이 늘고 파도가 커지는 곡선은 예전 4분 판 기준으로 잡혀 있어, 그 시계를 이만큼 빨리 돌려 2분 끝에 같은 세기에 닿게 한다.
 */
export const PACE = 240 / BATTLE_SECONDS

/** 파도 사이(초): 2분에 여덟 번. */
export const WAVE_SECONDS = 15
