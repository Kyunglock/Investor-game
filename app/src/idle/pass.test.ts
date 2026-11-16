import { describe, expect, it } from 'vitest'
import {
  focusStep,
  leftText,
  milestone,
  missionProgress,
  type Pass,
  type PassMission,
  type PassReward,
  rewardsText,
  stepProgress,
  stepState,
} from './pass'

/** 서버의 보상표 (529·568번): 보통 단계 다이아 50, 5의 배수는 200, 10·20은 300 + 무기, 30은 500 + 고양이. 한 단계에 300포인트. */
function pass(points: number, claimed: number[] = [], over: Partial<Pass> = {}): Pass {
  const step = Math.min(30, Math.floor(points / 300))
  const steps = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1
    return {
      step: n,
      diamonds: n === 30 ? 500 : n % 10 === 0 ? 300 : n % 5 === 0 ? 200 : 50,
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
    points,
    pointsPerStep: 300,
    step,
    claimable: steps.filter((s) => s.reached && !s.claimed).length,
    steps,
    missions: [],
    lastRewards: [],
    ...over,
  }
}
const reward = (over: Partial<PassReward>): PassReward => ({
  step: 1,
  diamonds: 0,
  weaponKind: null,
  weaponGrade: null,
  cat: null,
  catName: null,
  ...over,
})
const mission = (count: number, every: number): PassMission => ({
  code: 'wall',
  title: '매도벽 통과',
  count,
  target: (Math.floor(count / every) + 1) * every,
  every,
  points: 30,
  earned: Math.floor(count / every) * 30,
})

describe('시즌패스 (529·568번)', () => {
  it('남은 시간을 큰 단위 둘로 적는다', () => {
    expect(leftText(86400 * 12 + 3600 * 5 + 59)).toBe('12일 5시간 남음')
    expect(leftText(86400 * 3)).toBe('3일 남음')
    expect(leftText(3600 * 5 + 60 * 20)).toBe('5시간 20분 남음')
    expect(leftText(3600)).toBe('1시간 남음')
    expect(leftText(60 * 20 + 5)).toBe('20분 남음')
    expect(leftText(30)).toBe('곧 끝나요')
    expect(leftText(-5)).toBe('곧 끝나요')
  })

  it('다음 단계까지의 포인트를 센다', () => {
    expect(stepProgress(pass(0))).toEqual({ have: 0, need: 300, full: false })
    expect(stepProgress(pass(1020))).toEqual({ have: 120, need: 300, full: false })
    expect(stepProgress(pass(9000))).toEqual({ have: 300, need: 300, full: true })
  })

  it('단계의 상태와 큰 보상 단계를 가린다', () => {
    const p = pass(1020, [1])
    expect(p.steps.slice(0, 4).map(stepState)).toEqual(['claimed', 'ready', 'ready', 'locked'])
    expect(p.steps.filter(milestone).map((s) => s.step)).toEqual([5, 10, 15, 20, 25, 30])
  })

  it('열면 받을 수 있는 첫 단계, 없으면 오르고 있는 단계를 보여 준다', () => {
    expect(focusStep(pass(0))).toBe(1)
    expect(focusStep(pass(1020, [1]))).toBe(2)
    expect(focusStep(pass(1020, [1, 2, 3]))).toBe(4)
    expect(focusStep(pass(9000, [1]))).toBe(2)
    expect(
      focusStep(
        pass(
          9000,
          Array.from({ length: 30 }, (_, i) => i + 1),
        ),
      ),
    ).toBe(30)
  })

  it('미션은 다음 문턱까지의 진행도를 적는다', () => {
    expect(missionProgress(mission(0, 50))).toEqual({ text: '0/50', ratio: 0 })
    expect(missionProgress(mission(73, 50))).toEqual({ text: '73/100', ratio: 0.46 })
    expect(missionProgress(mission(1250, 50))).toEqual({ text: '1,250/1,300', ratio: 0 })
    // 하루에 한 번인 출석처럼 간격이 1이면 늘 다음 것을 가리킨다.
    expect(missionProgress(mission(3, 1))).toEqual({ text: '3/4', ratio: 0 })
  })

  it('받은 것을 한 줄로 적고 무기와 고양이는 이름을 적는다', () => {
    const weapons = [{ kind: 'revolver', grade: 'S', name: '리볼버', gradeName: 'S' }] as never
    expect(rewardsText([])).toBe('')
    expect(rewardsText([reward({ diamonds: 50 })])).toBe('다이아 +50')
    expect(
      rewardsText(
        [
          reward({ diamonds: 50 }),
          reward({ diamonds: 300, weaponKind: 'revolver', weaponGrade: 'S' }),
          reward({ diamonds: 500, cat: 'sky', catName: '하늘냥' }),
        ],
        weapons,
      ),
    ).toBe('다이아 +850 · 무기 리볼버 S · 고양이 하늘냥')
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
