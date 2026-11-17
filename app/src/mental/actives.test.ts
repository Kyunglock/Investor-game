import { describe, expect, it } from 'vitest'
import {
  ACTIVE_BANNERS,
  ACTIVE_HINTS,
  ACTIVE_NOTES,
  ACTIVES,
  type ActiveCode,
  averagingMult,
  BOOST,
  isBoost,
  stopLossDamage,
} from './actives'

describe('액티브 스킬 (503·587·588·590번)', () => {
  const codes = Object.keys(ACTIVES) as ActiveCode[]

  it('고유 스킬 여섯과 광고 스킬 셋이다', () => {
    expect(codes.filter((code) => !isBoost(code))).toEqual([
      'barrage',
      'rally',
      'fortify',
      'limitUp',
      'stopLoss',
      'averaging',
    ])
    expect(codes.filter(isBoost)).toEqual(['boostFire', 'boostDamage', 'boostBuy'])
  })

  it('스킬마다 알림·단추 설명·탭 설명이 있다', () => {
    for (const code of codes) {
      expect(ACTIVE_BANNERS[code][0]).not.toBe('')
      expect(ACTIVE_HINTS[code]).not.toBe('')
      expect(ACTIVE_NOTES[code]).not.toBe('')
    }
  })

  it('광고 스킬은 3배이고 전투 초로 90초(실제 60초) 이어진다: 서버 IdleEngine과 같다', () => {
    expect(BOOST).toBe(3)
    for (const code of codes.filter(isBoost)) expect(ACTIVES[code].seconds).toBe(90)
  })

  it('물타기는 매수벽이 가득 차면 1.5배, 깎인 만큼 커져 3배까지다', () => {
    expect(averagingMult(100, 100)).toBe(1.5)
    expect(averagingMult(50, 100)).toBe(2.25)
    expect(averagingMult(0, 100)).toBe(3)
    expect(averagingMult(150, 100)).toBe(1.5)
    expect(averagingMult(1, 0)).toBe(1.5)
  })

  it('손절은 가득 찬 매수벽의 절반을 버리면 매수 주문 240장어치이고 버린 만큼 준다', () => {
    expect(stopLossDamage(0.75, 50, 100)).toBe(0.75 * 240)
    expect(stopLossDamage(0.75, 25, 100)).toBe(0.75 * 120)
    expect(stopLossDamage(0.75, 0, 100)).toBe(0)
    expect(stopLossDamage(0.75, 80, 100)).toBe(0.75 * 240)
  })
})
