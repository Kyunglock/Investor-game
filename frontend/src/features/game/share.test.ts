import { describe, expect, it } from 'vitest'
import { sharedIdFrom } from './SharedPage'
import {
  characterGrid,
  facebookShareUrl,
  headline,
  lifeLine,
  type ShareCard,
  shareLink,
  shareText,
  xShareUrl,
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

  it('링크와 SNS 주소', () => {
    const link = shareLink('abcDEF234567', 'https://game.example')
    expect(link).toBe('https://game.example/r/abcDEF234567')
    expect(xShareUrl('나 & 너', link)).toContain(encodeURIComponent(link))
    expect(xShareUrl('나 & 너', link)).toContain(encodeURIComponent('나 & 너'))
    expect(facebookShareUrl(link)).toContain(encodeURIComponent(link))
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
