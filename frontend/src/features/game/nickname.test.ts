import { describe, expect, it } from 'vitest'
import type { Stats } from '../../api/client'
import { nickname } from './nickname'

const stats = (s: Partial<Stats>): Stats => ({
  insight: 50,
  patience: 50,
  courage: 50,
  conviction: 50,
  luck: 50,
  ...s,
})

describe('nickname', () => {
  it('가장 낮은 능력치가 수식어, 가장 높은 능력치가 정체성이다', () => {
    expect(nickname(stats({ insight: 80, patience: 20 })).name).toBe('성질 급한 족집게')
    expect(nickname(stats({ luck: 85, courage: 15 })).name).toBe('겁 많은 행운아')
    expect(nickname(stats({ courage: 80, conviction: 20 })).name).toBe('귀가 얇은 불도저')
  })

  it('약점이 게임에서 어떻게 드러나는지 알려 준다', () => {
    const result = nickname(stats({ insight: 80, courage: 15 }))
    expect(result.weakness).toBe('courage')
    expect(result.weaknessEffect).toContain('관망')
  })

  it('모두 높으면 천재, 모두 낮으면 험난, 고르면 보통이다', () => {
    // 모두 A(60) 이상이면 천재, 모두 E 이하(30 미만)면 험난, 퍼짐이 10 미만이면 보통.
    expect(
      nickname({ insight: 63, patience: 60, courage: 91, conviction: 75, luck: 60 }).name,
    ).toBe('타고난 투자 천재')
    expect(
      nickname({ insight: 17, patience: 29, courage: 10, conviction: 22, luck: 16 }).name,
    ).toBe('앞날이 험난한 사람')
    expect(
      nickname({ insight: 40, patience: 42, courage: 44, conviction: 49, luck: 41 }).name,
    ).toBe('무난한 보통 사람')
  })

  it('동점이면 안목 → 인내심 → 용기 → 줏대 → 운 순서로 앞의 것을 고른다', () => {
    const result = nickname(stats({ insight: 80, patience: 80, courage: 20, conviction: 20 }))
    expect(result.strength).toBe('insight')
    expect(result.weakness).toBe('courage')
  })
})
