import { describe, expect, it } from 'vitest'
import {
  focusStep,
  leftText,
  milestone,
  type Pass,
  type PassReward,
  rewardsText,
  stepAmount,
  stepProgress,
  stepState,
} from './pass'

/** 서버의 보상표 (529번): 다이아 50과 돈이 번갈아, 5의 배수는 200, 10·20은 300 + 무기, 30은 500 + 고양이. */
function pass(exp: number, claimed: number[] = [], over: Partial<Pass> = {}): Pass {
  const step = Math.min(30, Math.floor(exp / 100))
  const steps = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1
    const big = n % 5 === 0
    const diamonds = n === 30 ? 500 : n % 10 === 0 ? 300 : big ? 200 : n % 2 === 1 ? 50 : 0
    return {
      step: n,
      diamonds,
      money: diamonds === 0 ? 3_500_000 : null,
      weapon: n === 10 || n === 20,
      cat: n === 30,
      reached: n <= step,
      claimed: claimed.includes(n),
    }
  })
  return {
    season: 1,
    name: '시즌 1',
    endsAt: 0,
    secondsLeft: 86400 * 12,
    endingSoon: false,
    exp,
    expPerStep: 100,
    step,
    claimable: steps.filter((s) => s.reached && !s.claimed).length,
    steps,
    lastRewards: [],
    ...over,
  }
}
const reward = (over: Partial<PassReward>): PassReward => ({
  step: 1,
  diamonds: 0,
  money: 0,
  weaponKind: null,
  weaponGrade: null,
  cat: null,
  catName: null,
  ...over,
})

describe('시즌패스 (529번)', () => {
  it('남은 시간을 큰 단위 둘로 적는다', () => {
    expect(leftText(86400 * 12 + 3600 * 5 + 59)).toBe('12일 5시간 남음')
    expect(leftText(86400 * 3)).toBe('3일 남음')
    expect(leftText(3600 * 5 + 60 * 20)).toBe('5시간 20분 남음')
    expect(leftText(3600)).toBe('1시간 남음')
    expect(leftText(60 * 20 + 5)).toBe('20분 남음')
    expect(leftText(30)).toBe('곧 끝나요')
    expect(leftText(-5)).toBe('곧 끝나요')
  })

  it('다음 단계까지의 경험치를 센다', () => {
    expect(stepProgress(pass(0))).toEqual({ have: 0, need: 100, full: false })
    expect(stepProgress(pass(340))).toEqual({ have: 40, need: 100, full: false })
    expect(stepProgress(pass(3000))).toEqual({ have: 100, need: 100, full: true })
  })

  it('단계의 상태와 큰 보상 단계를 가린다', () => {
    const p = pass(340, [1])
    expect(p.steps.slice(0, 4).map(stepState)).toEqual(['claimed', 'ready', 'ready', 'locked'])
    expect(p.steps.filter(milestone).map((s) => s.step)).toEqual([5, 10, 15, 20, 25, 30])
  })

  it('열면 받을 수 있는 첫 단계, 없으면 오르고 있는 단계를 보여 준다', () => {
    expect(focusStep(pass(0))).toBe(1)
    expect(focusStep(pass(340, [1]))).toBe(2)
    expect(focusStep(pass(340, [1, 2, 3]))).toBe(4)
    expect(focusStep(pass(3000, [1]))).toBe(2)
    expect(
      focusStep(
        pass(
          3000,
          Array.from({ length: 30 }, (_, i) => i + 1),
        ),
      ),
    ).toBe(30)
  })

  it('단계 칸에는 다이아 수나 지금 받을 돈을 적는다', () => {
    const p = pass(0)
    expect(stepAmount(p.steps[0])).toBe('50')
    expect(stepAmount(p.steps[1])).toBe('3.5b')
    expect(stepAmount(p.steps[9])).toBe('300')
    expect(stepAmount({ ...p.steps[9], diamonds: 0 })).toBeNull()
  })

  it('받은 것을 한 줄로 적고 무기와 고양이는 이름을 적는다', () => {
    const weapons = [{ kind: 'revolver', grade: 'S', name: '리볼버', gradeName: 'S' }] as never
    expect(rewardsText([])).toBe('')
    expect(rewardsText([reward({ diamonds: 50 })])).toBe('다이아 +50')
    expect(
      rewardsText(
        [
          reward({ diamonds: 50 }),
          reward({ money: 3_500_000 }),
          reward({ diamonds: 300, weaponKind: 'revolver', weaponGrade: 'S' }),
          reward({ diamonds: 500, cat: 'sky', catName: '하늘냥' }),
        ],
        weapons,
      ),
    ).toBe('다이아 +850 · 돈 +3.5b · 무기 리볼버 S · 고양이 하늘냥')
    // 가진 무기 목록에 없으면 등급만, 이름 없는 고양이는 "한 마리".
    expect(
      rewardsText([reward({ weaponKind: 'smg', weaponGrade: 'B' }), reward({ cat: 'mint' })]),
    ).toBe('무기 B 등급 · 고양이 한 마리')
    // 무기가 셋을 넘으면 수로 줄인다.
    expect(
      rewardsText(Array.from({ length: 4 }, () => reward({ weaponKind: 'smg', weaponGrade: 'B' }))),
    ).toBe('무기 4개')
  })
})
