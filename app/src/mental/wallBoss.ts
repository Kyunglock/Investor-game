import { IDLE_BOSS_EVERY, idleBossWall } from './idlePierce'

/** 첫 칸은 기존 고래 그림, 나머지는 그림판에서 왼쪽부터 한 줄씩 읽은 순서다. */
const names = [
  '매도고래',
  '호가집게',
  '허매수여우',
  '금고거북',
  '투매복어',
  '속보까마귀',
  '체결문어',
  '반대매매천산갑',
  '동시호가코브라',
  '하한가불곰',
  '마감종코뿔소',
] as const

export function wallBoss(wall: number) {
  if (!Number.isSafeInteger(wall) || wall <= 0 || !idleBossWall(wall)) return null
  const index = (wall / IDLE_BOSS_EVERY - 1) % names.length
  return { name: names[index], tile: index === 0 ? null : index - 1 }
}
