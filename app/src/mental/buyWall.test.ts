import { describe, expect, it } from 'vitest'
import { IDLE_SELL_POWER } from './assault'
import {
  assaultBonusPercent,
  BUY_LOSS_MERGE_MS,
  BUY_WALL,
  BuyLossNote,
  BuyWall,
  buyOrderX,
  idleBuyOrderDamage,
  noteX,
  pushedByCollapse,
} from './buyWall'
import { orderShares } from './enemies'
import { SHARES_PER_HP, sharesOf } from './shares'

describe('매수 티켓의 좌우 분포', () => {
  it('왼쪽·오른쪽에 각각 40%, 중앙에 20%를 배치하고 영역 안에서도 위치가 달라진다', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => buyOrderX(0, 100, () => (i + 0.5) / 1000))
    expect(xs.filter((x) => x < 32)).toHaveLength(400)
    expect(xs.filter((x) => x > 68)).toHaveLength(400)
    expect(xs.filter((x) => x >= 32 && x <= 68)).toHaveLength(200)
    expect(new Set(xs).size).toBe(1000)
  })

  it('좁은 화면에서도 티켓 중심은 레인 양끝의 여백 안에 머문다', () => {
    for (const width of [254, 324, 702]) {
      for (const r of [0, 0.3999, 0.4, 0.7999, 0.8, 0.9999]) {
        const x = buyOrderX(33, width, () => r)
        expect(x).toBeGreaterThanOrEqual(33 + width * 0.08)
        expect(x).toBeLessThanOrEqual(33 + width * 0.92)
      }
    }
  })
})

describe('매수벽', () => {
  it('붕괴하면 80px 후퇴하고 1.5초 뒤 재건하며 그 뒤 1초간 보호한다', () => {
    const wall = new BuyWall(100)
    expect(wall.maxHp).toBe(50)
    expect(wall.hit(10)).toBe(false)
    expect(wall.hp).toBe(40)
    expect(wall.hit(45)).toBe(true)
    expect(wall.active).toBe(false)
    expect(wall.hp).toBe(0)
    expect(wall.rebuildLeft).toBe(1.5)
    expect(wall.hit(100)).toBe(false)
    expect(wall.breaks).toBe(1)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.step(0.35).retreat).toBeCloseTo(BUY_WALL.retreatDistance / 2)
    expect(wall.step(0.79).rebuilt).toBe(false)
    expect(wall.active).toBe(false)
    expect(wall.step(0.02).rebuilt).toBe(true)
    expect(wall.hp).toBe(wall.maxHp)
    expect(wall.hit(100)).toBe(false)
    wall.step(1)
    expect(wall.hit(100)).toBe(true)
    expect(wall.breaks).toBe(2)
  })
  it('매수 주문은 불규칙한 간격으로 다섯 장씩, 매도 물량 넷에 세 번 발사한다 (714·719번)', () => {
    let roll = 0
    const wall = new BuyWall(100, () => (roll++ % 2 === 0 ? 0 : 1))
    expect(wall.step(10).fireCount).toBe(0)
    // 매도 물량 하나로는 아직 쏘지 않는다: 둘째부터 쏜다.
    wall.sells = 1
    expect(wall.step(10).fireCount).toBe(0)
    wall.sells = 4
    expect(wall.step(0).fireCount).toBe(0)
    expect(wall.step(0.16).fireCount).toBe(5)
    expect(wall.step(0.3).fireCount).toBe(0)
    expect(wall.step(0.26).fireCount).toBe(5)
    expect(wall.step(0.16).fireCount).toBe(5)
    expect(wall.shots).toBe(15)
    expect(wall.step(10).fireCount).toBe(0)
  })
  it('재건 후 밀린 주문도 한 번에 다섯 장씩 보내고 총량을 보존한다', () => {
    const wall = new BuyWall(100, () => 0.5)
    wall.sells = 8
    wall.hit(100)
    expect(wall.step(1).fireCount).toBe(0)
    expect(wall.step(0.5).fireCount).toBe(0)
    expect(wall.step(0.34).fireCount).toBe(0)
    expect(wall.step(0.02).fireCount).toBe(5)
    for (let i = 0; i < 5; i++) expect(wall.step(0.36).fireCount).toBe(5)
    expect(wall.shots).toBe(30)
    expect(wall.step(10).fireCount).toBe(0)
  })
  it('추가 수익은 별 0·1·2·3개 → 0·25·50·100%다', () => {
    expect(assaultBonusPercent(0)).toBe(0)
    expect(assaultBonusPercent(1)).toBe(25)
    expect(assaultBonusPercent(2)).toBe(50)
    expect(assaultBonusPercent(3)).toBe(100)
  })
})

it('서킷브레이커는 발사 시계만 20%로 줄이고 총량과 재건 시간을 보존한다', () => {
  const normal = new BuyWall(100, () => 0.5)
  const halted = new BuyWall(100, () => 0.5)
  normal.sells = halted.sells = 20
  for (let i = 0; i < 240; i++) {
    normal.stepOrders(1 / 60)
    halted.stepOrders(0.2 / 60)
  }
  expect(halted.shots).toBeGreaterThan(0)
  expect(halted.shots).toBeLessThan(normal.shots)
  expect(halted.shots).toBeLessThanOrEqual(75)
  // 거래 정지 중에도 최종 발사량은 같다: 매도 물량 넷에 세 번, 다섯 장씩 (719번).
  for (let i = 0; i < 100; i++) halted.stepOrders(1)
  expect(halted.shots).toBe(75)
  expect(halted.stepOrders(10)).toBe(0)
  halted.hit(100)
  const rebuild = halted.rebuildLeft
  expect(halted.stepOrders(4)).toBe(0)
  expect(halted.rebuildLeft).toBe(rebuild)
})

describe('매수벽 붕괴 밀어내기 (#699)', () => {
  it('화면 중간선을 넘어온 적만 뒤로 민다', () => {
    expect(pushedByCollapse(100, 800)).toBe(false)
    expect(pushedByCollapse(399, 800)).toBe(false)
    expect(pushedByCollapse(400, 800)).toBe(true)
    expect(pushedByCollapse(700, 800)).toBe(true)
  })
  it('자동 전투는 재건이 길고, 체력 강화는 서 있는 벽에도 바로 붙는다 (492번)', () => {
    const wall = new BuyWall(100, () => 0.5, BUY_WALL.idleRebuildSeconds)
    wall.resize(130)
    expect(wall.maxHp).toBe(65)
    expect(wall.hp).toBe(65)
    wall.hit(60)
    wall.resize(100)
    expect(wall.hp).toBe(1)
    expect(wall.hit(10)).toBe(true)
    wall.step(BUY_WALL.rebuildSeconds)
    expect(wall.active).toBe(false)
    wall.resize(200)
    expect(wall.active).toBe(false)
    wall.step(BUY_WALL.idleRebuildSeconds)
    expect(wall.hp).toBe(100)
  })
  it('방어선 구축은 무너진 벽을 바로 세우고 그동안 깎이지 않게 한다 (503번)', () => {
    const wall = new BuyWall(100, () => 0.5)
    expect(wall.hit(wall.maxHp)).toBe(true)
    expect(wall.active).toBe(false)
    wall.fortify(6)
    expect(wall.active).toBe(true)
    expect(wall.hp).toBe(wall.maxHp)
    // 무적인 동안에는 맞아도 그대로다.
    expect(wall.hit(wall.maxHp)).toBe(false)
    expect(wall.hp).toBe(wall.maxHp)
    wall.step(6)
    expect(wall.hit(1)).toBe(false)
    expect(wall.hp).toBe(wall.maxHp - 1)
  })
})

describe('자동 전투의 매수 주문 피해 (710·711번)', () => {
  it('그 벽의 시장가 매도 한 장과 같은 수량이다: 40주 × 매도 물량 세기 × 물량 배율', () => {
    // 첫 벽(물량 배율 1): 시장가 240주, 매수 주문도 240주.
    expect(sharesOf(idleBuyOrderDamage(IDLE_SELL_POWER))).toBe(
      orderShares('market', IDLE_SELL_POWER),
    )
    expect(sharesOf(idleBuyOrderDamage(IDLE_SELL_POWER))).toBe(240)
    // 벽 100(물량 배율 1.8): 432주. 서버 IdleEngine.buyOrder(100)과 같다.
    expect(sharesOf(idleBuyOrderDamage(1.8 * IDLE_SELL_POWER))).toBe(432)
    expect(idleBuyOrderDamage(1.8 * IDLE_SELL_POWER)).toBeCloseTo(432 / SHARES_PER_HP)
  })

  it('손절은 지금 체력의 절반을 버리고, 벽은 무너지지 않는다 (591번)', () => {
    const wall = new BuyWall(200, () => 0.5)
    expect(wall.maxHp).toBe(100)
    expect(wall.sacrifice(0.5)).toBe(50)
    expect(wall.hp).toBe(50)
    // 무적(방어선 구축) 중에도 버린다.
    wall.fortify(6)
    expect(wall.sacrifice(0.5)).toBe(50)
    expect(wall.hp).toBe(50)
    // 1은 남기고, 무너진 벽에서는 버릴 것이 없다.
    wall.hp = 1
    expect(wall.sacrifice(1)).toBe(0)
    expect(wall.active).toBe(true)
    wall.hp = 0
    expect(wall.sacrifice(0.5)).toBe(0)
  })

  it('서킷브레이커는 서 있는 벽의 깎인 체력만 되채운다 (#913)', () => {
    const wall = new BuyWall(200, () => 0.5)
    wall.hit(60)
    wall.recover(20)
    expect(wall.hp).toBe(60)
    wall.recover(1000)
    expect(wall.hp).toBe(wall.maxHp)
    // 무너진 벽은 되살리지 않는다: 재건 시간을 그대로 기다린다.
    expect(wall.hit(wall.maxHp)).toBe(true)
    wall.recover(50)
    expect(wall.active).toBe(false)
  })
})

describe('매수벽이 깎인 양을 알리는 글자 (#915)', () => {
  it('한꺼번에 닿은 물량은 한 글자로 합치고, 시간이 지나면 새 글자로 띄운다', () => {
    const note = new BuyLossNote()
    expect(note.add(3, 1000)).toBe(false)
    expect(note.add(2, 1040)).toBe(true)
    expect(note.add(1, 1000 + BUY_LOSS_MERGE_MS - 1)).toBe(true)
    expect(note.total).toBe(6)
    // 합치는 시간은 처음 뜬 때부터 센다: 계속 맞아도 글자 하나가 끝없이 불어나지 않는다.
    expect(note.add(4, 1000 + BUY_LOSS_MERGE_MS)).toBe(false)
    expect(note.total).toBe(4)
  })

  it('글자는 화면 양 끝에서 잘리지 않게 안쪽으로 묶인다', () => {
    // 폭 100인 글자: 가운데가 58~262 사이에 있어야 320 화면에서 여백 8을 남긴다.
    expect(noteX(20, 100, 320)).toBe(58)
    expect(noteX(-40, 100, 320)).toBe(58)
    expect(noteX(310, 100, 320)).toBe(262)
    expect(noteX(160, 100, 320)).toBe(160)
  })
})
