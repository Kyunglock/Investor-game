import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { affordable, collected, diamondText, drawable, hirable } from './gachaRules'

function company(over: Record<string, unknown> = {}): Company {
  return {
    seats: 8,
    employees: [],
    meeting: { wanted: '' },
    diamonds: { amount: 500, draw: 100, tenDraw: 1000, tenCount: 11, hire: 100 },
    gacha: {
      roster: 0,
      rosterMax: 8,
      draws: 0,
      maxDraws: 10,
      rates: [],
      drawn: [],
      collection: [
        { grade: 'F', count: 2 },
        { grade: 'E', count: 0 },
        { grade: 'D', count: 1 },
      ],
    },
    ...over,
  } as unknown as Company
}

const diamonds = (amount: number) => ({ ...company().diamonds, amount })

describe('채용 뽑기 (decisions.md 312·526번)', () => {
  it('한 번에 뽑을 수 있는 수와 도감', () => {
    expect(drawable(company())).toBe(5)
    expect(drawable(company({ gacha: { ...company().gacha, roster: 6 } }))).toBe(2)
    expect(drawable(company({ diamonds: diamonds(99) }))).toBe(0)
    expect(drawable(company({ diamonds: diamonds(5000) }))).toBe(8)
    expect(
      drawable(
        company({
          seats: 20,
          gacha: { ...company().gacha, rosterMax: 20 },
          diamonds: diamonds(5000),
        }),
      ),
    ).toBe(10)
    expect(collected(company())).toBe(2)
  })

  it('다이아로 뽑을 수 있는 수는 한 명 값으로 나눈 몫이다', () => {
    expect(affordable(company())).toBe(5)
    expect(affordable(company({ diamonds: diamonds(199) }))).toBe(1)
    expect(affordable(company({ diamonds: diamonds(0) }))).toBe(0)
  })

  it('데려올 수 있는 수는 다이아와 남은 자리 가운데 작은 쪽이다', () => {
    expect(hirable(company())).toBe(5)
    expect(hirable(company({ diamonds: diamonds(5000) }))).toBe(8)
    expect(hirable(company({ seats: 2, employees: [{}, {}] }))).toBe(0)
    expect(hirable(company({ diamonds: diamonds(50) }))).toBe(0)
  })

  it('다이아 수는 십만부터 줄여 적는다', () => {
    expect(diamondText(1200)).toBe((1200).toLocaleString())
    expect(diamondText(99_999)).toBe((99_999).toLocaleString())
    expect(diamondText(100_000)).toBe('100a')
  })
})
