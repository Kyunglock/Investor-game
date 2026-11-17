import { describe, expect, it } from 'vitest'
import {
  ACTIVE_BANNERS,
  ACTIVE_HINTS,
  ACTIVE_NOTES,
  ACTIVES,
  type ActiveCode,
  BOOST,
  isBoost,
} from './actives'

describe('액티브 스킬 (503·587·588번)', () => {
  const codes = Object.keys(ACTIVES) as ActiveCode[]

  it('고유 스킬 셋과 광고 스킬 셋이다', () => {
    expect(codes.filter((code) => !isBoost(code))).toEqual(['barrage', 'rally', 'fortify'])
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
})
