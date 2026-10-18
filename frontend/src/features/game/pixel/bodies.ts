import type { Body } from './sprite'

/**
 * 나이 몸통 다섯. 머리는 headTop부터 8줄(머리카락 2, 이마 1, 얼굴 3, 입 1, 목 1)이고 눈은 headTop+4 줄의 5·10열(e)이다.
 * 장식과 표시는 이 좌표를 기준으로 그린다 (설계 7.1절).
 */
export type AgeStage = 'baby' | 'child' | 'adult' | 'middle' | 'old'

export const AGE_STAGES: AgeStage[] = ['baby', 'child', 'adult', 'middle', 'old']

export function stageFor(ageYears: number): AgeStage {
  if (ageYears <= 6) {
    return 'baby'
  }
  if (ageYears <= 13) {
    return 'child'
  }
  if (ageYears <= 39) {
    return 'adult'
  }
  if (ageYears <= 64) {
    return 'middle'
  }
  return 'old'
}

export const BODIES: Record<AgeStage, Body> = {
  // 작고 동글동글. 옷은 크림색.
  baby: {
    headTop: 5,
    map: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '......hhhh......',
      '....hhhhhhhh....',
      '....hsssssss....',
      '....ssssssss....',
      '....sessssse....',
      '....ssssssss....',
      '.....ssmmss.....',
      '......ssss......',
      '.....oooooo.....',
      '....oooooooo....',
      '....oooooooo....',
      '.....oooooo.....',
      '.....ss..ss.....',
      '................',
      '................',
    ],
  },
  child: {
    headTop: 3,
    map: [
      '................',
      '................',
      '................',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hsssssss....',
      '....ssssssss....',
      '....sessssse....',
      '....ssssssss....',
      '.....ssmmss.....',
      '......ssss......',
      '.....cccccc.....',
      '....cccccccc....',
      '...sccccccccs...',
      '....cccccccc....',
      '.....pppppp.....',
      '.....pp..pp.....',
      '.....bb..bb.....',
      '................',
      '................',
    ],
  },
  adult: {
    headTop: 1,
    map: [
      '................',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hsssssss....',
      '....ssssssss....',
      '....sessssse....',
      '....ssssssss....',
      '.....ssmmss.....',
      '......ssss......',
      '....cccccccc....',
      '...cccccccccc...',
      '..sccccccccccs..',
      '..sccccccccccs..',
      '...cccccccccc...',
      '....cccccccc....',
      '....pppppppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....bbb..bbb....',
    ],
  },
  // 흰머리가 섞이고 넥타이를 맨다.
  middle: {
    headTop: 1,
    map: [
      '................',
      '.....hhhhhh.....',
      '....GhhhhhhG....',
      '....Gsssssss....',
      '....ssssssss....',
      '....sessssse....',
      '....ssssssss....',
      '.....ssmmss.....',
      '......ssss......',
      '....cccttccc....',
      '...ccccttcccc...',
      '..sccccttccccs..',
      '..sccccccccccs..',
      '...cccccccccc...',
      '....cccccccc....',
      '....pppppppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....bbb..bbb....',
    ],
  },
  // 흰머리, 굽은 허리, 지팡이.
  old: {
    headTop: 3,
    map: [
      '................',
      '................',
      '................',
      '.....wwwwww.....',
      '....wwwwwwww....',
      '....wsssssss....',
      '....ssssssss....',
      '....sessssse....',
      '....ssssssss....',
      '.....ssmmss.....',
      '......ssss......',
      '....cccccccc....',
      '...cccccccccc...',
      '..sccccccccccsd.',
      '...cccccccccc.d.',
      '....cccccccc..d.',
      '....pppppppp..d.',
      '....ppp..ppp..d.',
      '....ppp..ppp..d.',
      '....bbb..bbb....',
    ],
  },
}
