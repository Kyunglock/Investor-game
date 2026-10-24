import { describe, expect, it } from 'vitest'
import { deviationMessage, shortWon, signedShortWon, withParticle, yearOf } from './labels'

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

describe('shortWon', () => {
  it('억·만 단위로 줄이고 만원 아래는 버린다', () => {
    expect(shortWon(248_580_568)).toBe('2억 4,858만원')
    expect(shortWon(200_000_000)).toBe('2억원')
    expect(shortWon(3_120_000)).toBe('312만원')
    expect(shortWon(12_345_678_901)).toBe('123억 4,567만원')
    expect(shortWon(9_999)).toBe('9,999원')
    expect(shortWon(0)).toBe('0원')
    expect(shortWon(-5_200_000)).toBe('−520만원')
  })

  it('부호를 붙인다', () => {
    expect(signedShortWon(3_517_588)).toBe('+351만원')
    expect(signedShortWon(-3_120_000)).toBe('−312만원')
    expect(signedShortWon(0)).toBe('0원')
  })
})

describe('withParticle', () => {
  it('받침이 있으면 을, 없으면 를. 한글이 아니면 받침 있는 쪽', () => {
    expect(withParticle('관망', '을', '를')).toBe('관망을')
    expect(withParticle('매수', '을', '를')).toBe('매수를')
    expect(withParticle('버틴다', '을', '를')).toBe('버틴다를')
    expect(withParticle('2000년 IT 버블', '을', '를')).toBe('2000년 IT 버블을')
    expect(withParticle('IMF', '을', '를')).toBe('IMF을')
  })
})
