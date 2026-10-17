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
    expect(
      nickname({ insight: 80, patience: 75, courage: 70, conviction: 72, luck: 90 }).name,
    ).toBe('타고난 투자 천재')
    expect(
      nickname({ insight: 20, patience: 25, courage: 15, conviction: 29, luck: 18 }).name,
    ).toBe('앞날이 험난한 사람')
    expect(nickname(stats({ insight: 55, luck: 45 })).name).toBe('무난한 보통 사람')
  })

  it('동점이면 안목 → 인내심 → 용기 → 줏대 → 운 순서로 앞의 것을 고른다', () => {
    const result = nickname(stats({ insight: 80, patience: 80, courage: 20, conviction: 20 }))
    expect(result.strength).toBe('insight')
    expect(result.weakness).toBe('courage')
  })
})
