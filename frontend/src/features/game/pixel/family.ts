import type { Game } from '../../../api/client'
import { stageFor } from './bodies'
import { CARRY } from './looks'
import { SCENE_WIDTH } from './scenes'
import { opposite } from './sexes'
import { SPRITE_WIDTH } from './sprite'
import type { Figure } from './vignettes'

/** 자리를 잡기 전의 사람 */
export type Member = Omit<Figure, 'x'>

/**
 * 아기는 서지 않고 업힌다 (decisions.md 178번). 배우자가 먼저, 다음은 내가 하나씩 업는다(어른 몸일 때만). 업을 사람이 모자라면 남은 아기는 선다.
 * 업힌 아기는 목록에서 빠지고 업은 사람의 carrying이 된다. 아기 머리가 보이는 쪽은 자리를 잡을 때 정한다(우선 오른쪽).
 */
export function carryBabies(members: Member[]): Member[] {
  const carriers = (['spouse', 'me'] as const)
    .map((who) => members.findIndex((m) => m.who === who))
    .filter((i) => i >= 0 && members[i].stage !== 'baby' && members[i].stage !== 'child')
  const out = members.map((m) => ({ ...m }))
  const carried = new Set<number>()
  members.forEach((m, i) => {
    if (m.who !== 'kid' || m.stage !== 'baby') {
      return
    }
    const carrier = carriers.shift()
    if (carrier == null) {
      return
    }
    out[carrier].carrying = { sex: m.sex, look: m.look ?? 0, side: 'right' }
    carried.add(i)
  })
  return out.filter((_, i) => !carried.has(i))
}

/** 몸이 차지하는 장면 칸(x 기준 왼쪽·오른쪽 끝). 몸은 16칸 중 가운데 12칸, 업은 아기는 그 쪽으로 더 나온다. */
export function spanOf(f: Pick<Figure, 'carrying'>): [number, number] {
  const side = f.carrying?.side
  return [2 - (side === 'left' ? CARRY.extra : 0), 13 + (side === 'right' ? CARRY.extra : 0)]
}

const fits = (f: Figure) => {
  const [l, r] = spanOf(f)
  return f.x + l >= 0 && f.x + r <= SCENE_WIDTH - 1
}

const apart = (a: Figure, b: Figure) => {
  const [al, ar] = spanOf(a)
  const [bl, br] = spanOf(b)
  return a.x + ar < b.x + bl || b.x + br < a.x + al
}

/** x에 세운다. 업은 아기는 배경 안에 드는 쪽 어깨로(오른쪽 먼저). */
function at(m: Member, x: number): Figure[] {
  const carrying = m.carrying
  if (!carrying) {
    return [{ ...m, x }]
  }
  return (['right', 'left'] as const).map((side) => ({
    ...m,
    x,
    carrying: { ...carrying, side },
  }))
}

/** 왼쪽(start)부터 몸이 닿지 않게 나란히 세운다. 배경 밖으로 나가는 사람부터는 그리지 않는다. */
export function lineUp(members: Member[], start = 2): Figure[] {
  const figures: Figure[] = []
  let x = start
  for (const m of members) {
    const f = at(m, x)[0]
    if (!fits(f)) {
      break
    }
    figures.push(f)
    // 다음 사람의 몸 왼쪽 끝(x+2)이 이 사람의 오른쪽 끝 바로 다음 칸
    x = f.x + spanOf(f)[1] - 1
  }
  return figures
}

/**
 * 장면에 세울 가족 (decisions.md 64번). 나는 anchor 자리, 배우자와 아이들은 옆에 번갈아 선다. 아이의 몸은 나이대로(아기·어린이·어른)이고 아기는
 * 업힌다(decisions.md 178번). 배경 밖으로 나가지 않고 서로 닿지 않는다. 배우자는 나와 반대 성별, 아이는 태어날 때 정해진 성별이다 (decisions.md 69번).
 */
export function familyFigures(game: Game, ageYears: number, meX: number): Figure[] {
  const members: Member[] = [{ who: 'me', sex: game.sex, stage: stageFor(ageYears) }]
  if (game.household.married) {
    members.push({ who: 'spouse', sex: opposite(game.sex), stage: stageFor(ageYears) })
  }
  // 독립해 나간 아이는 집 사진에 없다 (decisions.md 68번). 생김새는 태어난 순서로.
  game.household.children.forEach((c, i) => {
    if (!c.leftHome) {
      members.push({ who: 'kid', sex: c.sex, stage: stageFor(c.age), look: i })
    }
  })
  const [me, ...others] = carryBabies(members)
  const figures: Figure[] = [at(me, meX).find(fits) ?? at(me, meX)[0]]
  for (const m of others) {
    const f = place(figures, meX, m)
    if (f == null) {
      break
    }
    figures.push(f)
  }
  return figures
}

/** 내가 선 자리에서 가까운 칸부터, 내가 오른쪽이면 왼쪽을 먼저 */
function place(placed: Figure[], meX: number, m: Member): Figure | null {
  const leftFirst = meX >= SCENE_WIDTH / 2 - SPRITE_WIDTH / 2
  const slots = Array.from({ length: SCENE_WIDTH - SPRITE_WIDTH + 1 }, (_, x) => x).sort(
    (a, b) => Math.abs(a - meX) - Math.abs(b - meX) || (leftFirst ? a - b : b - a),
  )
  for (const x of slots) {
    const f = at(m, x).find((c) => fits(c) && placed.every((p) => apart(p, c)))
    if (f) {
      return f
    }
  }
  return null
}
