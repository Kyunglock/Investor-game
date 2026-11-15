import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { freeLeft, giveText, minutesText, type ShopItem, shopBlock } from './shop'

const item = (over: Partial<ShopItem>): ShopItem => ({
  code: 'x',
  name: '상품',
  priceDiamonds: 0,
  priceMoney: null,
  giveDiamonds: 0,
  giveIncomeMinutes: 0,
  giveMoney: null,
  dailyLimit: 1,
  left: 1,
  ...over,
})
const company = (over: {
  diamonds?: number
  capital?: number
  items?: ShopItem[]
  infinite?: boolean
}) =>
  ({
    capital: over.capital ?? 0,
    diamonds: { amount: over.diamonds ?? 0 },
    sandboxInfinite: over.infinite ?? false,
    shop: { items: over.items ?? [] },
  }) as unknown as Company

describe('상점 (541번)', () => {
  it('주는 것을 한 줄로 적는다', () => {
    expect(giveText(item({ giveDiamonds: 20 }))).toBe('다이아 20개')
    expect(giveText(item({ giveIncomeMinutes: 30, giveMoney: 87_300_000 }))).toBe(
      '돈 87.3b · 수입 30분어치',
    )
    expect(minutesText(120)).toBe('2시간')
    expect(minutesText(90)).toBe('1시간 30분')
  })

  it('오늘 다 샀거나 재화가 모자라면 살 수 없다', () => {
    const free = item({ giveDiamonds: 20 })
    expect(shopBlock(company({}), free)).toBeNull()
    expect(shopBlock(company({}), { ...free, left: 0 })).toBe('sold')
    const paid = item({ priceDiamonds: 60 })
    expect(shopBlock(company({ diamonds: 59 }), paid)).toBe('short')
    expect(shopBlock(company({ diamonds: 60 }), paid)).toBeNull()
    const cash = item({ priceMoney: 1000 })
    expect(shopBlock(company({ capital: 999 }), cash)).toBe('short')
    expect(shopBlock(company({ capital: 1000 }), cash)).toBeNull()
    expect(shopBlock(company({ infinite: true }), cash)).toBeNull()
  })

  it('무료 상품이 남아 있으면 상점 탭에 점을 단다', () => {
    const free = item({ giveDiamonds: 20 })
    expect(freeLeft(company({ items: [free, item({ priceDiamonds: 60 })] }))).toBe(true)
    expect(freeLeft(company({ items: [{ ...free, left: 0 }, item({ priceDiamonds: 60 })] }))).toBe(
      false,
    )
  })
})
