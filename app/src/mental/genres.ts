import type { Company } from '@web/api/client'

export type Genre = NonNullable<Company['mental']>['genre']

/** 장르 셋 (decisions.md 320번): 그 분기 이벤트가 정한다. 플레이어는 고르지 않는다. */
export interface GenreSpec {
  name: string
  hint: string
  /** 적이 어디서 오나: 사방 가장자리 또는 위쪽만. */
  spawn: 'edges' | 'top'
  /** 플레이어가 움직일 수 있는 곳: 자유 또는 아래 띠(좌우만). */
  area: 'free' | 'bottom'
  /** 적이 노리는 것: 플레이어 또는 가운데 금고. */
  target: 'player' | 'vault'
}

export const GENRES: Record<Genre, GenreSpec> = {
  ASSAULT: {
    name: '공격',
    hint: '적이 위에서 내려온다. 아래에서 좌우로 움직이며 뚫어라',
    spawn: 'top',
    area: 'bottom',
    target: 'player',
  },
  DEFENSE: {
    name: '디펜스',
    hint: '적이 가운데 금고로 몰려든다. 둘레를 돌며 막아라',
    spawn: 'edges',
    area: 'free',
    target: 'vault',
  },
  SURVIVAL: {
    name: '생존',
    hint: '사방에서 몰려온다. 돌아다니며 버텨라',
    spawn: 'edges',
    area: 'free',
    target: 'player',
  },
}

/** 한 판의 길이(초). 분기마다 한 판이라 짧게 (320번). */
export const BATTLE_SECONDS = 45
