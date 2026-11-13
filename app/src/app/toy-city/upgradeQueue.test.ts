import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { holdCharge, holdDelay, queuedCost, type UpgradeKind, UpgradeQueue } from './upgradeQueue'

/** 서버 흉내: 단계마다 4%씩 오르는 값, 자본이 닿는 데까지만 산다. */
function fakeServer(capital: number) {
  const levels: Record<UpgradeKind, number> = { damage: 0, fire: 0, hp: 0, buy: 0, crit: 0 }
  const price = (level: number) => Math.round(1_000_000 * 1.04 ** level)
  const company = () =>
    ({
      capital,
      battleUpgrades: (['damage', 'fire', 'hp'] as const).map((kind) => ({
        kind,
        level: levels[kind],
        price: price(levels[kind]),
        priceGrowthPercent: 4,
        bonusPercent: levels[kind],
        nextBonusPercent: levels[kind] + 1,
      })),
    }) as unknown as Company
  let current = company()
  const calls: Array<[UpgradeKind, number]> = []
  const waiting: Array<() => void> = []
  const send = (kind: UpgradeKind, n: number) => {
    calls.push([kind, n])
    return new Promise<Company | null>((resolve) => {
      waiting.push(() => {
        let bought = 0
        while (bought < n && capital >= price(levels[kind])) {
          capital -= price(levels[kind])
          levels[kind]++
          bought++
        }
        current = company()
        resolve(bought === 0 ? null : current)
      })
    })
  }
  return {
    send,
    current: () => current,
    calls,
    answer: async () => waiting.shift()?.(),
    /** 화면이 모르는 사이 서버의 자본이 준다(다른 창에서 쓴 돈). */
    drain: (amount: number) => {
      capital -= amount
    },
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('꾹 눌러 연속 강화 (394번)', () => {
  it('처음엔 0.4초마다, 점점 빨라져 0.05초까지', () => {
    expect(holdDelay(0)).toBe(400)
    expect(holdDelay(1)).toBe(320)
    expect(holdDelay(5)).toBeLessThan(holdDelay(4))
    expect(holdDelay(30)).toBe(50)
    expect(holdCharge(0)).toBe(0)
    expect(holdCharge(20)).toBe(1)
  })

  it('미리 셈한 값은 단계마다 비율로 오른다', () => {
    expect(queuedCost(1_000_000, 4, 0, 1)).toBe(1_000_000)
    expect(queuedCost(1_000_000, 4, 0, 2)).toBe(2_040_000)
    expect(queuedCost(1_000_000, 4, 1, 1)).toBe(1_040_000)
  })

  it('요청은 한 번에 하나, 그사이 누른 단계는 묶어 보낸다', async () => {
    const server = fakeServer(100_000_000)
    let short = 0
    const q = new UpgradeQueue(
      server.send,
      server.current,
      () => {},
      () => short++,
    )
    expect(q.push('damage')).toBe(true)
    expect(q.push('damage')).toBe(true)
    expect(q.push('damage')).toBe(true)
    expect(server.calls).toEqual([['damage', 1]])
    expect(q.view('damage')?.level).toBe(3)
    expect(q.view('damage')?.bonusPercent).toBe(3)
    await server.answer()
    await tick()
    expect(server.calls).toEqual([
      ['damage', 1],
      ['damage', 2],
    ])
    expect(q.view('damage')?.level).toBe(3)
    await server.answer()
    await tick()
    expect(q.busy()).toBe(false)
    expect(server.current().battleUpgrades?.[0].level).toBe(3)
    expect(q.capital()).toBe(server.current().capital)
    expect(short).toBe(0)
  })

  it('자본이 모자라면 더 줄을 세우지 않는다', async () => {
    const server = fakeServer(2_100_000)
    const q = new UpgradeQueue(server.send, server.current, () => {})
    expect(q.push('fire')).toBe(true)
    expect(q.push('fire')).toBe(true)
    expect(q.push('fire')).toBe(false)
    expect(q.capital()).toBe(60_000)
    await server.answer()
    await tick()
    await server.answer()
    await tick()
    expect(q.view('fire')?.level).toBe(2)
    expect(q.affordable('fire')).toBe(false)
  })

  it('서버가 덜 사 주면 줄을 비우고 서버 값으로 돌아간다', async () => {
    const server = fakeServer(10_000_000)
    let short = 0
    const q = new UpgradeQueue(
      server.send,
      server.current,
      () => {},
      () => short++,
    )
    expect(q.push('damage')).toBe(true)
    expect(q.push('damage')).toBe(true)
    expect(q.push('damage')).toBe(true)
    server.drain(7_900_000)
    await server.answer()
    await tick()
    // 첫 요청(1단계)은 샀고, 묶인 두 단계 가운데 하나만 닿는다.
    expect(server.calls).toEqual([
      ['damage', 1],
      ['damage', 2],
    ])
    await server.answer()
    await tick()
    expect(short).toBe(1)
    expect(q.busy()).toBe(false)
    expect(q.view('damage')?.level).toBe(2)
    expect(q.capital()).toBe(server.current().capital)
  })
})
