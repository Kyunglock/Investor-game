import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { tutorialMenuLocked, tutorialReady } from './onboarding'

const company = (step: number, unlocked = false) =>
  ({
    idle: { wall: 1, onboarding: { step, skillsUnlocked: unlocked } },
  }) as Company

describe('첫 출근 안내', () => {
  it('행동 단계에 맞춰 성장과 고양이를 열고 스킬 탭은 고양이 탭과 함께 열린다 (670번)', () => {
    expect(tutorialMenuLocked(company(0), 'growth')).toBe(true)
    expect(tutorialMenuLocked(company(1), 'growth')).toBe(false)
    expect(tutorialMenuLocked(company(2), 'cats')).toBe(true)
    expect(tutorialMenuLocked(company(3), 'cats')).toBe(false)
    expect(tutorialMenuLocked(company(0), 'skills')).toBe(false)
    expect(tutorialMenuLocked(company(3), 'skills')).toBe(false)
    expect(tutorialMenuLocked(company(8), 'skills')).toBe(false)
    expect(tutorialMenuLocked(company(0), 'shop')).toBe(false)
  })
  it('첫 돌파와 공격력 강화를 실제 서버 상태로 확인한다', () => {
    const c = company(0)
    expect(tutorialReady(c, 0)).toBe(false)
    if (c.idle) c.idle.wall = 2
    expect(tutorialReady(c, 0)).toBe(true)
    expect(tutorialReady(c, 1)).toBe(false)
    c.battleUpgrades = [{ kind: 'damage', level: 1 }] as Company['battleUpgrades']
    expect(tutorialReady(c, 1)).toBe(true)
  })
})
