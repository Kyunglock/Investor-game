import { describe, expect, it } from 'vitest'
import type { Game } from '../../api/client'
import { compactWon, stockSummary, worthBar, worthParts } from './worth'

type Home = Game['housing']['homes'][number]

function home(price: number, mortgage: number, tenantDeposit = 0): Home {
  return {
    seq: 1,
    regionName: '서울',
    price,
    purchasePrice: price,
    mortgage,
    monthlyPayment: 0,
    residence: tenantDeposit === 0,
    tenantDeposit,
    listed: false,
  }
}

function game(over: {
  cash?: number
  invested?: number
  debt?: number
  homes?: Home[]
  deposit?: number
  jeonseLoan?: number
  holdings?: { value: number; pnl: number }[]
}): Game {
  const homes = over.homes ?? []
  const deposit = over.deposit ?? 0
  const jeonseLoan = over.jeonseLoan ?? 0
  const cash = over.cash ?? 0
  const invested = over.invested ?? 0
  const debt = over.debt ?? 0
  // 서버와 같은 식: 현금 + 주식 − 빚 + 집 지분(보증금 − 전세대출 + Σ 시세 − 주담대 − 세입자 보증금)
  const equity =
    deposit - jeonseLoan + homes.reduce((s, h) => s + h.price - h.mortgage - h.tenantDeposit, 0)
  return {
    cash,
    invested,
    debt,
    totalAsset: cash + invested - debt + equity,
    holdings: over.holdings ?? [],
    housing: { homes, deposit, jeonseLoan },
  } as unknown as Game
}

const sum = (g: Game) => worthParts(g).reduce((s, p) => s + p.value, 0)

describe('전 재산 구성 (#210)', () => {
  it('항목의 합은 전 재산과 같고, 빚은 음수다', () => {
    const g = game({
      cash: 30_000_000,
      invested: 50_000_000,
      debt: 10_000_000,
      homes: [home(800_000_000, 400_000_000), home(500_000_000, 100_000_000, 300_000_000)],
    })
    expect(sum(g)).toBe(g.totalAsset)
    const parts = worthParts(g)
    expect(parts.find((p) => p.key === 'homes')?.value).toBe(500_000_000)
    expect(parts.find((p) => p.key === 'debt')?.value).toBe(-10_000_000)
  })

  it('전세는 보증금 − 전세대출이 보증금 칸이다', () => {
    const g = game({ cash: 1_000_000, deposit: 300_000_000, jeonseLoan: 200_000_000 })
    expect(sum(g)).toBe(g.totalAsset)
    expect(worthParts(g).find((p) => p.key === 'deposit')?.value).toBe(100_000_000)
  })

  it('막대는 플러스 항목만, 비율은 총자산(플러스 합) 기준이고 0원 항목은 빠진다', () => {
    const bar = worthBar(
      worthParts(game({ cash: 25_000_000, invested: 75_000_000, debt: 50_000_000 })),
    )
    expect(bar.gross).toBe(100_000_000)
    expect(bar.plus.map((p) => [p.key, p.share])).toEqual([
      ['cash', 2500],
      ['stocks', 7500],
    ])
    expect(bar.minus.map((p) => [p.key, p.share])).toEqual([['debt', 5000]])
  })

  it('시세보다 대출이 많은 집은 깎는 쪽으로 간다', () => {
    const bar = worthBar(
      worthParts(game({ cash: 10_000_000, homes: [home(300_000_000, 320_000_000)] })),
    )
    expect(bar.plus.map((p) => p.key)).toEqual(['cash'])
    expect(bar.minus.map((p) => [p.key, p.value])).toEqual([['homes', -20_000_000]])
  })

  it('가진 것이 없으면 총자산 0, 비율 0', () => {
    const bar = worthBar(worthParts(game({ debt: 5_000_000 })))
    expect(bar.gross).toBe(0)
    expect(bar.plus).toEqual([])
    expect(bar.minus[0].share).toBe(0)
  })

  it('주식 평가손익은 원가 대비', () => {
    const g = game({
      holdings: [
        { value: 1_200_000, pnl: 200_000 },
        { value: 900_000, pnl: -100_000 },
      ],
    })
    expect(stockSummary(g)).toEqual({ value: 2_100_000, pnl: 100_000, pnlBp: 500 })
  })
})

describe('좁은 자리 금액', () => {
  it('억은 소수 한 자리, 만은 반올림, 부호는 원할 때만', () => {
    expect(compactWon(460_000_000)).toBe('4.6억')
    expect(compactWon(500_000_000)).toBe('5억')
    expect(compactWon(3_100_000, true)).toBe('+310만')
    expect(compactWon(-850_000, true)).toBe('−85만')
    expect(compactWon(12_300_000_000)).toBe('123억')
    expect(compactWon(5_000)).toBe('5,000원')
  })
})
