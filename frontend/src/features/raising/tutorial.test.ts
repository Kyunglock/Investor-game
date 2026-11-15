import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { ALL_FEATURES, TUTORIAL_STEPS, tutorialStep, unlockedFeatures } from './tutorial'

function company(over: Partial<Company> = {}): Company {
  return { employees: [], invest: null, ...over } as unknown as Company
}

const seated = { employees: [{ id: 1, desk: 'bio' }] }

describe('튜토리얼 걸음 (decisions.md 302번, #803, #801)', () => {
  it('직원이 없으면 뽑기, 종목회의를 정하기 전이면 종목회의, 그 뒤는 키우기', () => {
    expect(tutorialStep(company())).toMatchObject({ id: 'hire', n: 1, tab: 'market' })
    // 뽑힌 직원은 서버가 바로 앉히므로 뽑고 나면 곧장 종목회의 걸음이다 (#801).
    const hired = company(seated as never)
    expect(tutorialStep(hired)).toMatchObject({
      id: 'meeting',
      n: 2,
      tab: 'meeting',
      spot: 'settle',
    })
    // 회의를 열기만 하고 아직 정하지 않았으면 그대로 종목회의 걸음이다.
    const opened = company({ ...seated, invest: { convened: true, outcome: null } } as never)
    expect(tutorialStep(opened)).toMatchObject({ id: 'meeting', n: 2 })
    const decided = company({ ...seated, invest: { outcome: { total: 0 } } } as never)
    expect(tutorialStep(decided)).toMatchObject({ id: 'grow', n: TUTORIAL_STEPS })
    expect(TUTORIAL_STEPS).toBe(3)
  })

  it('걸음마다 제목과 설명이 있고 분기·결산·배치를 말하지 않는다', () => {
    const all = [
      company(),
      company(seated as never),
      company({ ...seated, invest: { outcome: { total: 0 } } } as never),
    ].map(tutorialStep)
    expect(all.map((s) => s.n)).toEqual([1, 2, 3])
    for (const step of all) {
      expect(step.title).not.toBe('')
      expect(step.short).not.toBe('')
      expect(step.text).not.toContain('{')
      expect(`${step.title}${step.text}${step.short}`).not.toMatch(/분기|결산|배치/)
    }
  })
})

describe('튜토리얼 잠금·해금 (decisions.md 347번)', () => {
  it('처음엔 채용만, 걸음을 깰 때마다 열리고, 꺼져 있으면 전부 열려 있다', () => {
    expect(unlockedFeatures(company(), true)).toEqual(['market'])
    // 종목회의는 이슈 탭에서 열므로 둘이 함께 열린다.
    expect(unlockedFeatures(company(seated as never), true)).toEqual(['market', 'settle', 'issue'])
    const decided = company({ ...seated, invest: { outcome: { total: 0 } } } as never)
    expect(unlockedFeatures(decided, true)).toEqual(ALL_FEATURES)
    expect(ALL_FEATURES).toEqual(['market', 'settle', 'issue', 'upgrade'])
    expect(unlockedFeatures(company(), false)).toEqual(ALL_FEATURES)
  })
})
