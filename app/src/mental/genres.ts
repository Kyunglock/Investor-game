import type { Company } from '@web/api/client'

export type Genre = NonNullable<Company['mental']>['genre']

/** 장르 둘 (decisions.md 328·329·331번): 그 분기 이벤트가 정한다. 플레이어는 고르지 않는다. 적은 둘 다 위에서 내려온다. */
export interface GenreSpec {
  name: string
  hint: string
  /** 플레이어: 아래 띠에서 좌우로 움직이거나(bottom), 멘탈벽 앞에 붙박이로 서서 누른 쪽을 쏜다(fixed). */
  area: 'bottom' | 'fixed'
  /** 적이 노리는 것: 플레이어 또는 아래의 멘탈벽. */
  target: 'player' | 'wall'
}

export const GENRES: Record<Genre, GenreSpec> = {
  ASSAULT: {
    name: '공격',
    hint: '적이 위에서 내려온다. 아래에서 좌우로 움직이며 뚫어라',
    area: 'bottom',
    target: 'player',
  },
  DEFENSE: {
    name: '디펜스',
    hint: '적이 멘탈벽으로 몰려온다. 자리를 지키며 누른 쪽을 쏴라',
    area: 'fixed',
    target: 'wall',
  },
}

/** 한 판의 길이(초): 4분. 레벨이 예닐곱 번 오를 길이 (330번). */
export const BATTLE_SECONDS = 240
