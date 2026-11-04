import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InsightLens, lensTier } from './InsightLens'

describe('안목 렌즈 (decisions.md 161번)', () => {
  it('구간은 서버 힌트 구체성과 같은 경계다: 30 · 60 · 80', () => {
    expect([0, 29, 30, 59, 60, 79, 80, 100].map(lensTier)).toEqual([
      'low',
      'low',
      'mid',
      'mid',
      'high',
      'high',
      'expert',
      'expert',
    ])
  })

  it('안목 등급·점수·눈금과 읽히는 정도를 적고, 구간마다 초점 맞추는 움직임이 다르다', () => {
    const low = renderToStaticMarkup(
      createElement(InsightLens, { insight: 12, hint: '유리할지도?' }),
    )
    expect(low).toContain('흐릿하게 읽힌다')
    expect(low).toContain('animate-lens-low')
    expect(low).toContain('안목 1/4단계')
    const expert = renderToStaticMarkup(
      createElement(InsightLens, {
        insight: 91,
        hint: '이익 추정치가 올라갈 재료다',
        subject: '엔씽',
      }),
    )
    expect(expert).toContain('꿰뚫어 본다')
    expect(expert).toContain('animate-lens-expert')
    expect(expert).toContain('내 안목으로 본 엔씽')
    expect(expert).toContain('안목 4/4단계')
  })

  it('이벤트 카드에는 확률 숫자를 적지 않는다 (decisions.md 182번)', () => {
    const html = renderToStaticMarkup(
      createElement(InsightLens, { insight: 50, hint: '좋아 보인다', subject: '엔씽' }),
    )
    expect(html).toContain('대강 읽힌다')
    expect(html).not.toContain('%')
  })
})
