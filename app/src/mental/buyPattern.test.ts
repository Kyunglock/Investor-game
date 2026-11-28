import { describe, expect, it } from 'vitest'
import { BUY_PATTERNS, buyLaunch, buyPatternPreview, STEP_BEHIND } from './buyPattern'

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
  it('일자는 한 번에 뜨는 다섯 장이 가로 한 줄을 고르게 채운다 (714번)', () => {
    const xs = Array.from({ length: 10 }, (_, i) => buyLaunch('line', 0, 100, i))
    expect(xs.every((shot) => shot.behind === 0)).toBe(true)
    const row = xs.slice(0, 5).map((s) => Math.round(s.x))
    expect([...row].sort((a, b) => a - b)).toEqual([16, 33, 50, 67, 84])
    expect(xs.slice(5).map((s) => Math.round(s.x))).toEqual(row)
  })
  it('계단은 왼쪽으로 갈수록 한 칸씩 늦게 뜨고, 쐐기는 가운데가 가장 먼저 뜬다 (713번)', () => {
    const stairs = Array.from({ length: 6 }, (_, i) => buyLaunch('stairs', 0, 100, i))
    for (let i = 1; i < 6; i++) {
      expect(stairs[i].x).toBeGreaterThan(stairs[i - 1].x)
      expect(stairs[i - 1].behind - stairs[i].behind).toBeCloseTo(STEP_BEHIND)
    }
    expect(stairs[5].behind).toBe(0)
    const wedge = Array.from({ length: 5 }, (_, i) => buyLaunch('wedge', 0, 100, i))
    expect(wedge[0].x).toBeCloseTo(50)
    expect(wedge[0].behind).toBe(0)
    expect(wedge[1].behind).toBe(wedge[2].behind)
    expect(wedge[3].behind).toBeGreaterThan(wedge[1].behind)
  })
  it('어느 패턴도 앞에서 출발하지 않는다: 처지는 거리는 0 이상이다 (713번)', () => {
    for (const { code } of BUY_PATTERNS)
      for (let i = 0; i < 40; i++)
        expect(buyLaunch(code, 0, 100, i).behind).toBeGreaterThanOrEqual(0)
  })
  it('양쪽 기둥은 양 끝 두 줄에서 번갈아 뜬다', () => {
    const xs = Array.from({ length: 4 }, (_, i) => Math.round(buyLaunch('pillars', 0, 100, i).x))
    expect(xs).toEqual([18, 82, 18, 82])
  })
  it('미리 보기는 패턴마다 그림 안의 열다섯 자리이고 볼 때마다 같다', () => {
    for (const { code } of BUY_PATTERNS) {
      const dots = buyPatternPreview(code)
      expect(dots).toHaveLength(15)
      expect(dots.every((d) => d.x >= 0 && d.x <= 100 && d.y >= 0 && d.y <= 60)).toBe(true)
      expect(buyPatternPreview(code)).toEqual(dots)
    }
  })
  it('물결만 흔들리고, 번갈아 반대쪽으로 흔들린다', () => {
    expect(buyLaunch('even', 0, 100, 0).sway).toBe(0)
    const a = buyLaunch('wave', 0, 100, 0)
    const b = buyLaunch('wave', 0, 100, 1)
    expect(a.sway).toBeGreaterThan(0)
    expect(Math.abs(a.phase - b.phase)).toBeCloseTo(Math.PI)
  })
})
