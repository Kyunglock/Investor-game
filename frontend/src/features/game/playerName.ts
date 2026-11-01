import type { Game } from '../../api/client'

/** 아직 이름을 적지 않은 판(옛 판·봇)에 보이는 이름. */
export const UNNAMED = '이름 없는 투자자'

/** 이름은 1~8자 (서버와 같은 기준, decisions.md 135번). */
export const NAME_MAX_LENGTH = 8

/** 화면에 보일 이름. 사용자가 정한 이름이 없으면 대체 문구 (decisions.md 135번). */
export function playerName(game: Pick<Game, 'name'>): string {
  const name = game.name?.trim()
  return name ? name : UNNAMED
}

/** 입력한 이름이 저장할 수 있는 모양인가. 앞뒤 공백을 잘라 1~8자. */
export function validName(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.length >= 1 && [...trimmed].length <= NAME_MAX_LENGTH
}
