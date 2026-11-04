import { describe, expect, it } from 'vitest'
import type { Game } from '../../api/client'
import { homeSplit, realEstateTotals } from './homes'

type Home = Game['housing']['homes'][number]

const home = (over: Partial<Home>): Home => ({
  seq: 1,
  regionName: '서울',
  price: 1_000_000_000,
  purchasePrice: 800_000_000,
  mortgage: 0,
  monthlyPayment: 0,
  residence: true,
  tenantDeposit: 0,
  listed: false,
  ...over,
})

describe('집 한 채의 몫 (부동산 탭)', () => {
  it('시세를 내 몫·주담대·세입자 보증금으로 나누고, 산 값 대비 변화를 낸다', () => {
    const split = homeSplit(home({ mortgage: 400_000_000, tenantDeposit: 100_000_000 }))
    expect(split).toEqual({
      equity: 500_000_000,
      equityBp: 5000,
      mortgageBp: 4000,
      tenantBp: 1000,
      underwater: false,
      gainBp: 2500,
    })
  })

  it('대출이 시세보다 많으면 내 몫은 0칸이고 대출 칸들이 전체를 채운다', () => {
    const split = homeSplit(
      home({ price: 500_000_000, mortgage: 400_000_000, tenantDeposit: 200_000_000 }),
    )
    expect(split.underwater).toBe(true)
    expect(split.equity).toBe(-100_000_000)
    expect(split.equityBp).toBe(0)
    expect(split.mortgageBp + split.tenantBp).toBe(10_000)
  })
})

describe('부동산 합계', () => {
  it('내 몫은 집 시세 − 주담대 − 세입자 보증금 + 보증금 − 전세대출', () => {
    const totals = realEstateTotals({
      deposit: 300_000_000,
      jeonseLoan: 200_000_000,
      homes: [
        home({ mortgage: 400_000_000 }),
        home({ price: 500_000_000, tenantDeposit: 300_000_000 }),
      ],
    } as Game['housing'])
    expect(totals).toEqual({
      count: 2,
      price: 1_500_000_000,
      mortgage: 400_000_000,
      tenant: 300_000_000,
      deposit: 100_000_000,
      net: 900_000_000,
    })
  })
})
