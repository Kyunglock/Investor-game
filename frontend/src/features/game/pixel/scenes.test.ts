import { describe, expect, it } from 'vitest'
import { dwellingFor, SCENES, sceneCaption, sceneFor } from './scenes'

describe('sceneFor', () => {
  it('나이·단계·직업으로 장면을 고른다 (설계 8절)', () => {
    expect(sceneFor('baby', 'CHILDHOOD', false)).toBe('nursery')
    expect(sceneFor('child', 'CHILDHOOD', false)).toBe('school')
    expect(sceneFor('adult', 'CHILDHOOD', false)).toBe('street')
    expect(sceneFor('adult', 'SAVING', true)).toBe('office')
    expect(sceneFor('adult', 'INVESTING', true)).toBe('studio')
    expect(sceneFor('middle', 'INVESTING', true)).toBe('studio-middle')
    expect(sceneFor('middle', 'SAVING', true)).toBe('studio-middle')
    expect(sceneFor('old', 'ENDED', true)).toBe('home-old')
    expect(sceneFor('old', 'INVESTING', true)).toBe('home-old')
  })
})

describe('SCENES', () => {
  it('모든 장면은 64열 20행이고 캐릭터 발 위치가 격자 안에 있다', () => {
    for (const [key, scene] of Object.entries(SCENES)) {
      expect(scene.map, key).toHaveLength(20)
      for (const row of scene.map) {
        expect(row, key).toHaveLength(64)
      }
      expect(scene.anchor.x, key).toBeGreaterThanOrEqual(0)
      expect(scene.anchor.x + 16, key).toBeLessThanOrEqual(64)
      expect(scene.anchor.y, key).toBe(20)
      expect(scene.caption, key).toMatch(/^서울 · /)
    }
  })
})

describe('sceneCaption', () => {
  const home = { totalAsset: 30_000_000, married: false, children: 0, fullTimeInvestor: false }

  it('사는 곳은 자산과 가족으로 정해서 수십억 자산가가 원룸에 살지 않는다', () => {
    expect(dwellingFor(30_000_000, false, 0)).toBe('원룸')
    expect(dwellingFor(30_000_000, true, 0)).toBe('신혼 빌라')
    expect(dwellingFor(300_000_000, false, 0)).toBe('투룸 전세')
    expect(dwellingFor(1_000_000_000, false, 0)).toBe('아파트')
    expect(dwellingFor(3_000_000_000, true, 2)).toBe('고급 아파트')
    expect(dwellingFor(6_000_000_000, false, 0)).toBe('한강뷰 펜트하우스')
    expect(sceneCaption('studio-middle', { ...home, totalAsset: 3_000_000_000 })).toBe(
      '서울 · 고급 아파트 · 오랜 투자를 이어 가는 중',
    )
  })

  it('전업투자자에게는 퇴근 후라고 하지 않는다', () => {
    expect(sceneCaption('studio', home)).toBe('서울 · 원룸 · 퇴근 후 주식 앱을 켜는 중')
    expect(sceneCaption('studio', { ...home, fullTimeInvestor: true })).toBe(
      '서울 · 원룸 · 하루 종일 시세판을 보는 중',
    )
  })
})
