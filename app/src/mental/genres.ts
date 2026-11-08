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

/** 한 판의 길이(초): 4분. 레벨이 예닐곱 번 오를 길이 (330번). */
export const BATTLE_SECONDS = 240
