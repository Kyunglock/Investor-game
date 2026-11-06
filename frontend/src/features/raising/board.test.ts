import { describe, expect, it } from 'vitest'
import { bubbleOf, moveOf, pnlLabel, rivalFor, wreathsFor } from './board'

describe('결산 전광판과 이사 장면 (증권사 육성 설계 8.3절)', () => {
  it('말풍선은 그해 가장 많이 뒤집힌 능력치의 한마디이고, 손익과 어긋나지 않는다', () => {
    expect(bubbleOf({ patience: 2, conviction: 1 }, -100)).toBe('못 참고 팔았습니다…')
    expect(bubbleOf({ patience: 1, conviction: 1 }, -100)).toBe('단톡방 보고 샀습니다…')
    // 손이 떨렸어도 그해 벌었으면 "못 샀다"로 끝내지 않는다.
    expect(bubbleOf({ courage: 1 }, 30_677_668)).toBe('한 번 손이 떨렸지만 그래도 벌었어요')
    expect(bubbleOf({}, 5)).toBe('맞혔습니다!')
    expect(bubbleOf({}, -5)).toBe('이번엔 틀렸네요…')
    expect(bubbleOf({}, 0)).toBeNull()
  })

  it('손익 0이면 본전이고, 크게 벌거나 잃으면 그만큼, 같은 상황도 직원과 해마다 말이 바뀐다 (255번)', () => {
    expect(bubbleOf({ conviction: 1 }, 0)).toBe('본전입니다. 올해는 쉬어 간 셈이죠.')
    expect(bubbleOf({}, 40, 100)).toBe('올해는 제가 회사를 먹여 살렸습니다')
    expect(bubbleOf({}, -40, 100)).toBe('면목이 없습니다…')
    expect(bubbleOf({}, 10, 100)).toBe('맞혔습니다!')
    const lines = new Set([0, 1, 2, 3].map((seed) => bubbleOf({ conviction: 1 }, 5, 100, seed)))
    expect(lines.size).toBeGreaterThan(1)
    for (const line of lines) {
      expect(line).toMatch(/벌었어요|운이 좋았네요/)
    }
  })

  it('손익은 만 원 아래를 버리고 부호를 붙인다', () => {
    expect(pnlLabel(30_677_668)).toBe('+3,067만원')
    expect(pnlLabel(-5_478_155)).toBe('−547만원')
    expect(pnlLabel(123_450_000)).toBe('+1억 2,345만원')
    expect(pnlLabel(0)).toBe('0원')
    expect(pnlLabel(1_500_000_000_000)).toBe('+1조 5,000억원')
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

describe('라이벌 증권사 (decisions.md 243번)', () => {
  it('해마다 다른 라이벌이 나온다', () => {
    expect(rivalFor(1)).not.toBe(rivalFor(2))
    expect(rivalFor(1)).toBe(rivalFor(6))
  })
})
