/** 승인된 비교 그림에서 제목·흰 여백을 제외한 전장 영역만 쓴다. */
export const ARENA_MAPS = [
  { key: 'toy-city', name: '토이 시티', x: 10 },
  { key: 'neon-street', name: '네온 거리', x: 478 },
  { key: 'candy-factory', name: '캔디 공장', x: 946 },
  { key: 'space-station', name: '우주 정거장', x: 1414 },
] as const

export const ARENA_FRAME = { y: 59, width: 458, height: 764 }

/** 누적 플레이 횟수가 아니라 현재 매도벽을 따라가므로 재접속·후퇴에도 같은 맵이다. */
export function arenaMap(wall: number) {
  return ARENA_MAPS[Math.floor((Math.max(1, wall) - 1) / 50) % ARENA_MAPS.length]
}

export function stageArenaMap(stage: number) {
  return ARENA_MAPS[(Math.max(1, stage) - 1) % ARENA_MAPS.length]
}
