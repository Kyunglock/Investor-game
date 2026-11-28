import { describe, expect, it } from 'vitest'
import { BUY_PATTERNS, buyLaunch } from './buyPattern'

describe('매수 주문이 날아가는 패턴 (712번)', () => {
  const seq = (n: number) => Array.from({ length: n }, (_, i) => (i + 0.5) / n)
  it('어느 패턴이든 레인 안에서 뜬다', () => {
    for (const { code } of BUY_PATTERNS) {
      const rolls = seq(200)
      let at = 0
      for (let i = 0; i < 100; i++) {
        const shot = buyLaunch(code, 50, 300, i, () => rolls[at++ % rolls.length])
        expect(shot.x - shot.sway).toBeGreaterThanOrEqual(50)
        expect(shot.x + shot.sway).toBeLessThanOrEqual(350)
      }
    }
  })
  it('양옆은 양 끝에, 가운데는 가운데에 몰린다', () => {
    const rolls = seq(1000)
    const sides = rolls.map((r) => buyLaunch('sides', 0, 100, 0, () => r).x)
    expect(sides.filter((x) => x < 32 || x > 68)).toHaveLength(800)
    let at = 0
    const center = Array.from(
      { length: 400 },
      (_, i) => buyLaunch('center', 0, 100, i, () => rolls[at++ % rolls.length]).x,
    )
    expect(center.every((x) => x > 30 && x < 70)).toBe(true)
  })
  it('훑기는 왼쪽 끝에서 오른쪽 끝으로 차례로 갔다가 돌아온다', () => {
    const xs = Array.from({ length: 17 }, (_, i) => buyLaunch('sweep', 0, 100, i).x)
    expect(xs[0]).toBeCloseTo(8)
    expect(xs[8]).toBeCloseTo(92)
    expect(xs[16]).toBeCloseTo(8)
    for (let i = 1; i <= 8; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    for (let i = 9; i <= 16; i++) expect(xs[i]).toBeLessThan(xs[i - 1])
  })
  it('물결만 흔들리고, 번갈아 반대쪽으로 흔들린다', () => {
    expect(buyLaunch('even', 0, 100, 0).sway).toBe(0)
    const a = buyLaunch('wave', 0, 100, 0)
    const b = buyLaunch('wave', 0, 100, 1)
    expect(a.sway).toBeGreaterThan(0)
    expect(Math.abs(a.phase - b.phase)).toBeCloseTo(Math.PI)
  })
})
