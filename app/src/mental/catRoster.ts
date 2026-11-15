import type { CatCode } from '@web/features/raising/store'
import frames from './catRosterFrames.json'

/** 승인 시안 08~40. 앞의 동료 6종 ID와 인덱스는 보존한다. */
export const NEW_CATS = [
  { code: 'caramel', name: '카라멜냥', model: 'hero', color: '#e7ad56', atlas: 0, slot: 0 },
  { code: 'mocha', name: '모카냥', model: 'fold', color: '#895e49', atlas: 0, slot: 1 },
  { code: 'peach', name: '복숭아냥', model: 'hero', color: '#eda49a', atlas: 0, slot: 2 },
  { code: 'silver', name: '은빛냥', model: 'fluffy', color: '#aaa8b6', atlas: 1, slot: 0 },
  { code: 'panda', name: '판다냥', model: 'hero', color: '#625052', atlas: 1, slot: 1 },
  { code: 'biscuit', name: '비스킷냥', model: 'fold', color: '#d5a477', atlas: 1, slot: 2 },
  { code: 'ocean', name: '바다냥', model: 'hero', color: '#78b0bd', atlas: 2, slot: 0 },
  { code: 'lemon', name: '레몬냥', model: 'fluffy', color: '#edd279', atlas: 2, slot: 1 },
  { code: 'cocoa', name: '코코아냥', model: 'hero', color: '#865c49', atlas: 2, slot: 2 },
  { code: 'rose', name: '로즈냥', model: 'hero', color: '#cf9b9f', atlas: 3, slot: 0 },
  { code: 'tiger', name: '호랑냥', model: 'hero', color: '#e39a45', atlas: 3, slot: 1 },
  { code: 'cloud', name: '구름냥', model: 'fluffy', color: '#bbc8dc', atlas: 3, slot: 2 },
  { code: 'star', name: '별빛냥', model: 'hero', color: '#797baf', atlas: 4, slot: 0 },
  { code: 'siam', name: '샴냥', model: 'hero', color: '#b99b83', atlas: 4, slot: 1 },
  { code: 'tilt', name: '짝귀냥', model: 'fold', color: '#a69e9c', atlas: 4, slot: 2 },
  { code: 'russet', name: '단풍냥', model: 'fluffy', color: '#c87d5b', atlas: 5, slot: 0 },
  { code: 'sage', name: '세이지냥', model: 'hero', color: '#acb58e', atlas: 5, slot: 1 },
  { code: 'apricot', name: '살구냥', model: 'hero', color: '#eaba87', atlas: 5, slot: 2 },
  { code: 'plum', name: '자두냥', model: 'fluffy', color: '#80647e', atlas: 6, slot: 0 },
  { code: 'patch', name: '조각냥', model: 'hero', color: '#c8aa87', atlas: 6, slot: 1 },
  { code: 'drowsy', name: '졸린냥', model: 'fold', color: '#b0a8aa', atlas: 6, slot: 2 },
  { code: 'coral', name: '산호냥', model: 'fluffy', color: '#e5a293', atlas: 7, slot: 0 },
  { code: 'truffle', name: '트러플냥', model: 'hero', color: '#8a6456', atlas: 7, slot: 1 },
  { code: 'frost', name: '서리냥', model: 'hero', color: '#9eafcb', atlas: 7, slot: 2 },
  { code: 'butter', name: '버터냥', model: 'fold', color: '#e8c489', atlas: 8, slot: 0 },
  { code: 'terra', name: '테라냥', model: 'hero', color: '#c98f72', atlas: 8, slot: 1 },
  { code: 'wisteria', name: '등꽃냥', model: 'fluffy', color: '#b6a0c1', atlas: 8, slot: 2 },
  { code: 'odd', name: '오드냥', model: 'hero', color: '#645e68', atlas: 9, slot: 0 },
  { code: 'pistachio', name: '피스타냥', model: 'hero', color: '#b0b88a', atlas: 9, slot: 1 },
  { code: 'sand', name: '모래냥', model: 'hero', color: '#cfa975', atlas: 9, slot: 2 },
  { code: 'blush', name: '볼터치냥', model: 'fluffy', color: '#ebc9b9', atlas: 10, slot: 0 },
  { code: 'petrol', name: '청록냥', model: 'fold', color: '#7194a3', atlas: 10, slot: 1 },
  { code: 'oat', name: '오트냥', model: 'fluffy', color: '#c6a185', atlas: 10, slot: 2 },
] as const satisfies readonly {
  code: CatCode
  name: string
  model: 'hero' | 'fold' | 'fluffy'
  color: string
  atlas: number
  slot: number
}[]

/** 생성 원본은 보존한다. 승인한 개별 그림 경계로 읽어 인접 행이 섞이지 않게 한다. */
export const ROSTER_FRAMES = frames
export function rosterCell(
  source: { width: number; height: number },
  atlas: number,
  slot: number,
  pose?: number,
) {
  const sheet = ROSTER_FRAMES[atlas]
  const cell = sheet.cells[slot * 10 + (pose === undefined ? 0 : pose + 1)]
  return {
    x: (cell.x * source.width) / sheet.width,
    y: (cell.y * source.height) / sheet.height,
    w: (cell.w * source.width) / sheet.width,
    h: (cell.h * source.height) / sheet.height,
  }
}
