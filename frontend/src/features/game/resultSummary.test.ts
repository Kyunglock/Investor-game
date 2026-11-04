import { describe, expect, it } from 'vitest'
import type { CreditSection } from './credits'
import { highlights } from './resultSummary'

const art = { vignette: 'family' as const, figures: [] }
const s = (key: string, withArt = true): CreditSection => ({
  key,
  title: key,
  lines: [{ text: key }],
  art: withArt ? art : undefined,
})

describe('결과지 하이라이트 (decisions.md 193번)', () => {
  it('그림 장 가운데 결혼·첫아이·집·위기를 먼저 골라 시간순으로, 태어남·마지막은 뺀다', () => {
    const sections = [
      s('title', false),
      s('born'),
      s('work'),
      s('family'),
      s('child-1'),
      s('child-2'),
      s('trip-9'),
      s('home-12'),
      s('crisis-20'),
      s('review', false),
      s('last'),
    ]
    expect(highlights(sections).map((h) => h.key)).toEqual([
      'family',
      'child-1',
      'home-12',
      'crisis-20',
    ])
  })

  it('장이 적으면 있는 만큼', () => {
    expect(highlights([s('born'), s('work'), s('last')]).map((h) => h.key)).toEqual(['work'])
  })
})
