import type { EnemyKind } from './enemies'

export const ARENA_FRAME = { width: 458, height: 764 }
export const ARENA_SHEETS = {
  arenaMaps: { width: 1881, height: 836, y: 59 },
  marketArenas: { width: 1374, height: 764, y: 0 },
  picnicArenas: { width: 916, height: 764, y: 0 },
  greenhouseHarbor: { width: 916, height: 764, y: 0 },
} as const

/** 떼·줄·대열 순으로 나오는 이 전장의 일반 몹. */
export type StageRoster = readonly [EnemyKind, EnemyKind, EnemyKind]

export interface ArenaMap {
  key: string
  name: string
  x: number
  sheet: keyof typeof ARENA_SHEETS
  roster: StageRoster
}

export const ARENA_MAPS: readonly ArenaMap[] = [
  {
    key: 'toy-city',
    name: '토이 시티',
    sheet: 'arenaMaps',
    x: 10,
    roster: ['panic', 'dump', 'stop'],
  },
  {
    key: 'neon-street',
    name: '네온 거리',
    sheet: 'arenaMaps',
    x: 478,
    roster: ['panic', 'stop', 'short'],
  },
  {
    key: 'candy-factory',
    name: '캔디 공장',
    sheet: 'arenaMaps',
    x: 946,
    roster: ['panic', 'honeyBear', 'spec'],
  },
  {
    key: 'space-station',
    name: '우주 정거장',
    sheet: 'arenaMaps',
    x: 1414,
    roster: ['starPuff', 'dump', 'short'],
  },
  {
    key: 'glasshouse',
    name: '유리온실',
    sheet: 'greenhouseHarbor',
    x: 0,
    roster: ['blossomBun', 'stop', 'honeyBear'],
  },
  {
    key: 'moonlit-harbor',
    name: '달빛 부두',
    sheet: 'greenhouseHarbor',
    x: 458,
    roster: ['panic', 'coinCrab', 'short'],
  },
  {
    key: 'honey-bakery',
    name: '꿀빛 제과점',
    sheet: 'marketArenas',
    x: 0,
    roster: ['panic', 'honeyBear', 'dump'],
  },
  {
    key: 'pearl-aquarium',
    name: '진주 수족관',
    sheet: 'marketArenas',
    x: 458,
    roster: ['pearlSeal', 'coinCrab', 'stop'],
  },
  {
    key: 'star-observatory',
    name: '별빛 천문대',
    sheet: 'marketArenas',
    x: 916,
    roster: ['starPuff', 'stop', 'spec'],
  },
  {
    key: 'blossom-garden',
    name: '벚꽃 정원',
    sheet: 'picnicArenas',
    x: 0,
    roster: ['blossomBun', 'dump', 'stop'],
  },
  {
    key: 'snow-rink',
    name: '눈꽃 스케이트장',
    sheet: 'picnicArenas',
    x: 458,
    roster: ['iceChick', 'pearlSeal', 'short'],
  },
]

/** 누적 플레이 횟수가 아니라 현재 매도벽을 따라가므로 재접속·후퇴에도 같은 맵이다. */
export function arenaMap(wall: number) {
  return ARENA_MAPS[Math.floor((Math.max(1, wall) - 1) / 50) % ARENA_MAPS.length]
}

export function stageArenaMap(stage: number) {
  return ARENA_MAPS[(Math.max(1, stage) - 1) % ARENA_MAPS.length]
}
