import { describe, expect, it } from 'vitest'
import { bubbleOf, moveOf, wreathsFor } from './board'

describe('결산 전광판과 이사 장면 (증권사 육성 설계 8.3절)', () => {
  it('말풍선은 그해 가장 많이 뒤집힌 능력치의 한마디이고, 뒤집히지 않았으면 없다', () => {
    expect(bubbleOf({})).toBeNull()
    expect(bubbleOf({ patience: 2, conviction: 1 })).toBe('못 참고 팔았습니다…')
    expect(bubbleOf({ patience: 1, conviction: 1 })).toBe('단톡방 보고 샀습니다…')
  })

  it('등급이 오르면 이사, 떨어지면 작은 사무실로, 그대로면 없다', () => {
    expect(moveOf('F', 'E')).toBe('up')
    expect(moveOf('SSS', 'X')).toBe('up')
    expect(moveOf('D', 'E')).toBe('down')
    expect(moveOf('C', 'C')).toBeNull()
  })

  it('축하 화환은 단골 인물 셋이 보내고 해마다 앞사람이 바뀐다', () => {
    expect(wreathsFor(0)).toEqual(['경쟁사 김대리', '리딩방 방장', '사촌 형'])
    expect(wreathsFor(1)[0]).toBe('리딩방 방장')
  })
})
