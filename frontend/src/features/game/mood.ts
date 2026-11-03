/** 행복도·가족 점수가 지금 게임에 주는 영향을 한 줄로 (#230, decisions.md 165번). 서버 MoodEffect·Comforter와 같은 문턱이다. */
export const MOOD_LOW = 30
export const MOOD_HIGH = 70
export const FAMILY_WARM = 70
export const FAMILY_COLD = 20

export function moodNote(happiness: number): string {
  if (happiness < MOOD_LOW) {
    return '마음이 가라앉아 판단이 흔들린다 (인내·줏대 −10, 일도 잘 안 풀린다)'
  }
  if (happiness >= MOOD_HIGH) {
    return '마음이 편해 판단이 단단하다 (인내·줏대 +5, 일도 잘 풀린다)'
  }
  return '마음이 평온하다'
}

/** 가족이 있을 때만 부른다. */
export function familyNote(family: number): string {
  if (family < FAMILY_COLD) {
    return '가족과 남처럼 멀어졌다 (위로도 여행도 없다, 행복도가 40까지 떨어진다)'
  }
  if (family >= FAMILY_WARM) {
    return '가족이 든든하다 (위로가 깊고, 행복도가 높은 자리로 돌아온다)'
  }
  return '가족과 그럭저럭 지낸다'
}
