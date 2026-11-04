import { describe, expect, it } from 'vitest'
import { sharedIdFrom } from './SharedPage'
import {
  characterGrid,
  headline,
  kakaoFeed,
  lifeLine,
  moneyLine,
  type ShareCard,
  shareLink,
  shareText,
} from './share'

const stats = { insight: 50, patience: 50, courage: 50, conviction: 50, luck: 50 }

const card = (over: Partial<ShareCard> = {}): ShareCard => ({
  name: '버핏',
  sex: 'M',
  finalAge: 70,
  ending: 'NORMAL',
  initialAsset: 0,
  finalAsset: 1_234_000_000,
  returnBp: 0,
  rank: 3,
  initialStats: stats,
  finalStats: stats,
  investorTypeCode: 'long-safe-own',
  investorTypeName: '장기 소신형',
  investorTypeDescription: '흔들리지 않고 오래 간다.',
  sectorName: '반도체',
  jobTitle: '개발자',
  married: true,
  children: 2,
  home: 'OWN',
  ...over,
})

describe('결과 공유 문구 (#197)', () => {
  it('이름·나이·엔딩·자산과 처지를 한 줄로', () => {
    expect(headline(card())).toBe('70세 은퇴 · 최종 자산 12억 3,400만원')
    expect(lifeLine(card())).toBe('개발자 · 결혼 · 아이 2명 · 내 집')
    expect(lifeLine(card({ jobTitle: null, married: false, children: 0, home: 'MONTHLY' }))).toBe(
      '무직 · 미혼 · 월세',
    )
  })

  it('인생 공유와 성향만 공유', () => {
    expect(shareText(card())).toContain('버핏의 인생')
    expect(shareText(card())).toContain('순위표 3위')
    expect(shareText(card(), 'type')).toMatch(/^나는 '장기 소신형' 투자자/)
    expect(shareText(card({ name: null }))).toContain('어느 투자자의 인생')
  })

  it('링크', () => {
    expect(shareLink('abcDEF234567', 'https://game.example')).toBe(
      'https://game.example/r/abcDEF234567',
    )
  })

  it('시작 → 최종 자산과 수익률 (#275)', () => {
    expect(moneyLine(card({ initialAsset: 100_000_000, returnBp: 1234 }))).toBe(
      '시작 1억원 → 최종 12억 3,400만원 · 수익률 +12.3%',
    )
    expect(moneyLine(card())).not.toContain('수익률')
  })

  it('카카오톡 카드는 요약 그림과 결과 보기·나도 해 보기 버튼 (#275)', () => {
    const feed = kakaoFeed(card(), 'abcDEF234567', 'life', true, 'https://game.example')
    expect(feed.content.title).toBe('버핏의 인생 · 70세 은퇴 · 최종 자산 12억 3,400만원')
    expect(feed.content.description).toBe("'장기 소신형' 투자자 · 개발자 · 결혼 · 아이 2명 · 내 집")
    expect(feed.content.imageUrl).toBe('https://game.example/api/shares/abcDEF234567/card.png')
    expect(feed.content.link.webUrl).toBe('https://game.example/share/abcDEF234567')
    expect(feed.buttons.map((b) => b.title)).toEqual(['결과 보기', '나도 해 보기'])
    expect(feed.buttons[1].link.webUrl).toBe('https://game.example')

    const type = kakaoFeed(card(), 'abcDEF234567', 'type', false, 'https://game.example')
    expect(type.content.title).toBe("나는 '장기 소신형' 투자자")
    expect(type.content.description).toBe('흔들리지 않고 오래 간다.')
    expect(type.content.imageUrl).toBe('https://game.example/og-card.png')
  })

  it('공유 페이지 주소에서 ID를 꺼낸다', () => {
    expect(sharedIdFrom('/share/abcDEF234567')).toBe('abcDEF234567')
    expect(sharedIdFrom('/share/abc')).toBeNull()
    expect(sharedIdFrom('/')).toBeNull()
    expect(sharedIdFrom('/share/<script>')).toBeNull()
  })

  it('카드 그림은 끝날 때 나이의 32×40 캐릭터다', () => {
    const grid = characterGrid(card())
    expect(grid).toHaveLength(40)
    expect(grid[0]).toHaveLength(32)
  })
})
