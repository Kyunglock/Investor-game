import { describe, expect, it } from 'vitest'
import { MAX_MATES } from './cards'
import { MATE_GAP, MATE_LOOKS, MATE_MARGIN, mateFormation, spreadTargets } from './mates'

describe('함께 싸우는 고양이 (decisions.md 393번)', () => {
  it('고양이마다 색과 이름이 있고 최대 수만큼 있다', () => {
    expect(MATE_LOOKS).toHaveLength(MAX_MATES)
    expect(new Set(MATE_LOOKS.map((l) => l.color)).size).toBe(MAX_MATES)
  })

  it('혼자면 사장냥은 가운데에 선다', () => {
    expect(mateFormation(1, 390)).toEqual([0])
  })

  it('줄 전체가 가운데에 오고, 사장냥은 가운데(짝수면 가운데 왼쪽), 고양이는 오른쪽·왼쪽·오른쪽 끝 순으로 붙는다', () => {
    const [hero, a, b, c] = mateFormation(4, 390)
    expect(hero).toBeLessThan(0)
    expect(a).toBeGreaterThan(hero)
    expect(b).toBeLessThan(hero)
    expect(c).toBeGreaterThan(a)
    expect(hero + a + b + c).toBeCloseTo(0)
    expect(mateFormation(3, 390)[0]).toBe(0)
  })

  it('간격은 화면 폭에 맞춰 좁아지고 화면 밖으로 나가지 않는다', () => {
    for (const width of [320, 360, 390, 430, 768]) {
      for (let n = 1; n <= MAX_MATES + 1; n++) {
        const line = mateFormation(n, width).sort((x, y) => x - y)
        const gaps = line.slice(1).map((x, i) => x - line[i])
        for (const g of gaps) expect(g).toBeLessThanOrEqual(MATE_GAP + 1e-9)
        // 가장자리 고양이의 몸 가운데는 화면 안쪽 틈 안에 있다.
        expect(width / 2 + (line.at(-1) ?? 0)).toBeLessThanOrEqual(width - MATE_MARGIN)
        expect(width / 2 + line[0]).toBeGreaterThanOrEqual(MATE_MARGIN)
      }
    }
    expect(mateFormation(4, 320)[1] - mateFormation(4, 320)[0]).toBeCloseTo((320 - 44) / 4)
  })
})

describe('고양이마다 다른 적을 노린다 (409번)', () => {
  const shooters = [
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: -80, y: 0 },
  ]

  it('적이 넉넉하면 저마다 가까운 다른 적을 맡는다', () => {
    const enemies = [
      { x: 0, y: -100, id: 'a' },
      { x: 90, y: -110, id: 'b' },
      { x: -90, y: -120, id: 'c' },
      { x: 0, y: -400, id: 'far' },
    ]
    const picked = spreadTargets(shooters, enemies, 520).map((e) => e?.id)
    expect(picked).toEqual(['a', 'b', 'c'])
  })

  it('적이 쏘는 수보다 적으면 남는 고양이는 가까운 적을 함께 쏜다', () => {
    const enemies = [
      { x: 70, y: -100, id: 'a' },
      { x: -70, y: -100, id: 'b' },
    ]
    // 사장냥이 a, 오른쪽 고양이가 남은 b를 맡고, 왼쪽 고양이는 저에게 가까운 b를 함께 쏜다.
    const picked = spreadTargets(shooters, enemies, 520).map((e) => e?.id)
    expect(picked).toEqual(['a', 'b', 'b'])
  })

  it('사거리 밖이거나 적이 없으면 아무도 안 노린다', () => {
    expect(spreadTargets(shooters, [{ x: 0, y: -900 }], 520)).toEqual([null, null, null])
    expect(spreadTargets(shooters, [], 520)).toEqual([null, null, null])
  })
})
