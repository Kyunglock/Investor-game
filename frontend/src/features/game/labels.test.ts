import { describe, expect, it } from 'vitest'
import { deviationMessage, yearOf } from './labels'

describe('yearOf', () => {
  it('1세는 탄생 연도 2025년이다', () => {
    expect(yearOf(1)).toBe(2025)
  })

  it('31세는 2055년이다', () => {
    expect(yearOf(31)).toBe(2055)
  })
})

describe('deviationMessage', () => {
  it('줏대 이탈은 꼬드김 출처가 문구가 된다', () => {
    expect(deviationMessage('conviction', 'HOLD', 'BUY', 'youtuber')).toBe(
      "줏대 부족 — 구독자 많은 주식 유튜버가 '지금이 기회'라며 떠드는 걸 보고 관망 대신 매수했다",
    )
    expect(deviationMessage('conviction', 'BUY', 'HOLD', 'friend')).toBe(
      "줏대 부족 — 친구가 '내부 정보'라며 귀띔해 준 말에 매수하려던 걸 접었다",
    )
    expect(deviationMessage('conviction', 'BUY', 'SELL', null)).toBe(
      '줏대 부족 — 다른 뉴스에 휘둘려 매수 대신 매도했다',
    )
  })

  it('인내심은 충동 매도, 용기는 겁나서 관망', () => {
    expect(deviationMessage('patience', 'HOLD', 'SELL')).toContain('못 참고 매도했다')
    expect(deviationMessage('courage', 'BUY', 'HOLD')).toContain('겁나서 관망했다')
  })
})
