import type { Game } from '../../api/client'

type Home = Game['housing']['homes'][number]

/** 집 한 채의 시세를 내 몫·주담대·세입자 보증금으로 나눈 몫(만분율). 대출이 시세보다 많으면 내 몫은 0이고 underwater다. */
export interface HomeSplit {
  equity: number
  equityBp: number
  mortgageBp: number
  tenantBp: number
  underwater: boolean
  /** 산 값 대비 시세 변화(만분율) */
  gainBp: number
}

export function homeSplit(home: Home): HomeSplit {
  const equity = home.price - home.mortgage - home.tenantDeposit
  const base = Math.max(home.price, home.mortgage + home.tenantDeposit, 1)
  const share = (v: number) => Math.round((Math.max(0, v) * 10_000) / base)
  return {
    equity,
    equityBp: share(equity),
    mortgageBp: share(home.mortgage),
    tenantBp: share(home.tenantDeposit),
    underwater: equity < 0,
    gainBp:
      home.purchasePrice > 0
        ? Math.trunc(((home.price - home.purchasePrice) * 10_000) / home.purchasePrice)
        : 0,
  }
}

/** 부동산 탭 머리의 합계: 집 시세·대출·세입자 보증금과 지금 사는 집의 보증금 − 전세대출. 내 몫은 전 재산의 부동산 + 보증금과 같다. */
export function realEstateTotals(housing: Game['housing']) {
  const homes = housing.homes
  const price = homes.reduce((s, h) => s + h.price, 0)
  const mortgage = homes.reduce((s, h) => s + h.mortgage, 0)
  const tenant = homes.reduce((s, h) => s + h.tenantDeposit, 0)
  const deposit = housing.deposit - housing.jeonseLoan
  return {
    count: homes.length,
    price,
    mortgage,
    tenant,
    deposit,
    net: price - mortgage - tenant + deposit,
  }
}
