export const ARENA_FRAME = { width: 458, height: 764 }
export const ARENA_SHEETS = {
  arenaMaps: { width: 1881, height: 836, y: 59 },
  greenhouseHarbor: { width: 916, height: 764, y: 0 },
} as const

export type LocalMob = 'sprout' | 'coinCrab'

export interface ArenaMap {
  key: string
  name: string
  x: number
  sheet: keyof typeof ARENA_SHEETS
  mob?: LocalMob
}

export const ARENA_MAPS: readonly ArenaMap[] = [
  { key: 'toy-city', name: '토이 시티', sheet: 'arenaMaps', x: 10 },
  { key: 'neon-street', name: '네온 거리', sheet: 'arenaMaps', x: 478 },
  { key: 'candy-factory', name: '캔디 공장', sheet: 'arenaMaps', x: 946 },
  { key: 'space-station', name: '우주 정거장', sheet: 'arenaMaps', x: 1414 },
  { key: 'glasshouse', name: '유리온실', sheet: 'greenhouseHarbor', x: 0, mob: 'sprout' },
  { key: 'moonlit-harbor', name: '달빛 부두', sheet: 'greenhouseHarbor', x: 458, mob: 'coinCrab' },
]

/** 누적 플레이 횟수가 아니라 현재 매도벽을 따라가므로 재접속·후퇴에도 같은 맵이다. */
export function arenaMap(wall: number) {
  return ARENA_MAPS[Math.floor((Math.max(1, wall) - 1) / 50) % ARENA_MAPS.length]
}

export function stageArenaMap(stage: number) {
  return ARENA_MAPS[(Math.max(1, stage) - 1) % ARENA_MAPS.length]
}
