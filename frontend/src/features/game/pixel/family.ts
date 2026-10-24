import type { Game } from '../../../api/client'
import { stageFor } from './bodies'
import { SCENE_WIDTH } from './scenes'
import { SPRITE_WIDTH } from './sprite'
import type { Figure } from './vignettes'

/**
 * 장면에 세울 가족 (decisions.md 64번). 나는 anchor 자리, 배우자와 아이들은 옆에 번갈아 선다. 아이의 몸은 나이대로(아기·어린이·어른). 배경 밖으로 나가지
 * 않고 서로 10칸 이상 떨어진다.
 */
/** 몸은 16칸 중 가운데 12칸을 차지한다. 14칸 띄우면 겹치지 않는다. 내가 오른쪽에 서 있으면 가족은 왼쪽부터 */
const OFFSETS = [14, 28, 42]
const MIN_GAP = 13

export function familyFigures(game: Game, ageYears: number, meX: number): Figure[] {
  const figures: Figure[] = [{ who: 'me', stage: stageFor(ageYears), x: meX }]
  const others: Figure['who'][] = []
  if (game.household.married) {
    others.push('spouse')
  }
  for (let i = 0; i < game.household.children.length; i++) {
    others.push('kid')
  }
  const kids = game.household.children.map((c) => c.age)
  let kidIndex = 0
  for (const who of others) {
    const stage = who === 'spouse' ? stageFor(ageYears) : stageFor(kids[kidIndex++] ?? 0)
    const x = place(figures, meX)
    if (x == null) {
      break
    }
    figures.push({ who, stage, x })
  }
  return figures
}

function place(placed: Figure[], meX: number): number | null {
  const leftFirst = meX >= SCENE_WIDTH / 2 - SPRITE_WIDTH / 2
  const candidates = OFFSETS.flatMap((o) => (leftFirst ? [-o, o] : [o, -o]))
  for (const offset of candidates) {
    const x = Math.max(0, Math.min(SCENE_WIDTH - SPRITE_WIDTH, meX + offset))
    if (placed.every((f) => Math.abs(f.x - x) >= MIN_GAP)) {
      return x
    }
  }
  return null
}
