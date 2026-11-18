import { describe, expect, it } from 'vitest'
import {
  DAMAGE_STYLE,
  type DamageKind,
  DamagePool,
  damageLabel,
  MERGE_MS,
  scatterOffset,
  shownDamage,
  wallNumberSpot,
} from './damageNumbers'

describe('데미지 숫자 (decisions.md 391번)', () => {
  it('아무리 작은 피해도 숫자가 뜬다: 화상 한 틱도 1 이상', () => {
    expect(shownDamage(1)).toBe(10)
    expect(shownDamage(0.15)).toBe(2)
    expect(shownDamage(0.01)).toBe(1)
  })

  it('매도벽 돌파에서는 일반·치명타·지속 공격을 매도벽과 같은 주 단위로 표시한다', () => {
    expect(damageLabel('bullet', 8, true)).toBe('1,200주')
    expect(damageLabel('crit', 2, true)).toBe('300주!')
    expect(damageLabel('meteor', 0.01, true)).toBe('2주')
    expect(damageLabel('bullet', 2)).toBe('20')
  })

  it('치명타만 느낌표, 더 크고 오래 남으며 합치지 않는다(충차의 들이받기도 한 방씩)', () => {
    expect(damageLabel('crit', 2)).toBe('20!')
    expect(damageLabel('bullet', 2)).toBe('20')
    for (const kind of Object.keys(DAMAGE_STYLE) as DamageKind[]) {
      if (kind === 'crit') continue
      expect(DAMAGE_STYLE.crit.scale).toBeGreaterThan(DAMAGE_STYLE[kind].scale)
      expect(DAMAGE_STYLE.crit.life).toBeGreaterThan(DAMAGE_STYLE[kind].life)
      expect(DAMAGE_STYLE[kind].merge).toBe(kind !== 'siege')
    }
    expect(DAMAGE_STYLE.crit.merge).toBe(false)
    // 땅 (433번): 벽을 들이받는 한 방은 지나가며 밀친 피해보다 크다.
    expect(DAMAGE_STYLE.siege.scale).toBeGreaterThan(DAMAGE_STYLE.earth.scale)
  })

  it('마법 피해는 총알과 다른 색: 물 파랑·불 주황·번개 노랑, 불 지속은 불보다 작다', () => {
    const bullet = DAMAGE_STYLE.bullet.color
    const magics = ['water', 'meteor', 'lightning', 'earth'] as const
    for (const kind of magics) {
      expect(DAMAGE_STYLE[kind].color).not.toBe(bullet)
    }
    expect(new Set(magics.map((k) => DAMAGE_STYLE[k].color)).size).toBe(4)
    expect(DAMAGE_STYLE.chain.color).toBe(DAMAGE_STYLE.lightning.color)
  })

  it('숫자는 빨리 사라진다: 적이 들어오는 길을 오래 가리지 않게 0.7초 안', () => {
    for (const style of Object.values(DAMAGE_STYLE)) {
      expect(style.life).toBeLessThanOrEqual(700)
      expect(style.life).toBeGreaterThan(MERGE_MS)
    }
  })

  it('같은 적의 같은 피해는 짧은 시간 안이면 하나로 합친다', () => {
    const pool = new DamagePool(['a', 'b', 'c'])
    const enemy = {}
    const first = pool.take(enemy, 'bullet', 1, 0)
    const second = pool.take(enemy, 'bullet', 2, MERGE_MS - 1)
    expect(second.merged).toBe(true)
    expect(second.slot).toBe(first.slot)
    expect(first.slot.total).toBe(3)
    // 처음 뜬 때부터 세므로 계속 맞아도 한 숫자가 끝없이 남지 않는다.
    expect(pool.take(enemy, 'bullet', 1, MERGE_MS).merged).toBe(false)
  })

  it('다른 적·다른 종류·치명타·사라진 숫자에는 합치지 않는다', () => {
    const pool = new DamagePool(['a', 'b', 'c', 'd', 'e'])
    const enemy = {}
    const shown = pool.take(enemy, 'bullet', 1, 0)
    expect(pool.take({}, 'bullet', 1, 10).merged).toBe(false)
    expect(pool.take(enemy, 'chain', 1, 10).merged).toBe(false)
    pool.take(enemy, 'crit', 2, 10)
    expect(pool.take(enemy, 'crit', 2, 20).merged).toBe(false)
    pool.release(shown.slot)
    expect(pool.take(enemy, 'bullet', 1, 30).merged).toBe(false)
  })

  it('풀은 크기를 넘지 않고 가장 오래된 칸을 돌려 쓴다', () => {
    const pool = new DamagePool(['a', 'b'])
    const one = pool.take({}, 'bullet', 1, 0)
    pool.take({}, 'bullet', 1, 1)
    const three = pool.take({}, 'bullet', 1, 2)
    expect(three.slot).toBe(one.slot)
    expect(pool.live()).toBe(2)
  })

  it('같은 적에 새로 뜨는 숫자는 차례대로 흩뿌려 겹치지 않는다', () => {
    const pool = new DamagePool(['a', 'b', 'c', 'd'])
    const enemy = {}
    const ns = [0, 1, 2].map((i) => pool.take(enemy, 'bullet', 1, i * MERGE_MS).n)
    expect(ns).toEqual([0, 1, 2])
    const spots = ns.map((n) => scatterOffset(n))
    expect(new Set(spots.map((s) => `${s.dx},${s.dy}`)).size).toBe(3)
    for (const s of spots) {
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(16)
      expect(Math.abs(s.dy)).toBeLessThanOrEqual(12)
    }
  })

  it('매도벽의 숫자는 가운데의 남은 물량을 비켜 양옆으로 번갈아 뜬다 (#914)', () => {
    const left = 33
    const width = 324
    const center = left + width / 2
    const spots = [0, 1, 2, 3, 4, 5, 6].map((n) => wallNumberSpot(n, left, width, 200, 100))
    for (const [n, spot] of spots.entries()) {
      // 남은 물량 글자가 서는 가운데(폭의 4분의 1 안쪽)에는 숫자의 중심이 오지 않고, 벽 밖으로도 나가지 않는다.
      expect(Math.abs(spot.x - center)).toBeGreaterThan(width / 4)
      expect(spot.x).toBeGreaterThan(left)
      expect(spot.x).toBeLessThan(left + width)
      expect(Math.sign(spot.x - center)).toBe(n % 2 === 0 ? -1 : 1)
      expect(Math.abs(spot.y - 200)).toBeLessThanOrEqual(12)
    }
    // 같은 쪽에 잇달아 뜨는 숫자는 자리가 다르다.
    expect(spots[0]).not.toEqual(spots[2])
    expect(spots[2]).not.toEqual(spots[4])
  })

  it('맨 위 벽의 숫자는 머리띠 쪽으로 올라가지 않게 낮춰 띄운다 (#914)', () => {
    expect(wallNumberSpot(0, 33, 324, 90, 108).y).toBe(108)
    expect(wallNumberSpot(1, 33, 324, 90, 108).y).toBe(108)
    expect(wallNumberSpot(0, 33, 324, 200, 108).y).toBe(200)
  })
})
