import type { Company } from '@web/api/client'
import { diamondText } from '@web/features/raising/gachaRules'

/** 시즌패스 (decisions.md 529·570번): 서버가 주는 시즌·포인트·미션·단계 보상. */
export type Pass = Company['pass']
export type PassStep = Pass['steps'][number]
export type PassReward = Pass['lastRewards'][number]
export type PassMission = Pass['missions'][number]
type Weapons = NonNullable<Company['weapons']>

/** 남은 시간: "12일 5시간 남음" · "5시간 20분 남음" · "20분 남음". 1분이 안 되면 "곧 끝나요". */
export function leftText(secondsLeft: number): string {
  const minutes = Math.floor(Math.max(0, secondsLeft) / 60)
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return h > 0 ? `${d}일 ${h}시간 남음` : `${d}일 남음`
  if (h > 0) return m > 0 ? `${h}시간 ${m}분 남음` : `${h}시간 남음`
  return m > 0 ? `${m}분 남음` : '곧 끝나요'
}

/** 다음 단계까지의 포인트: 이번 단계에서 모은 것과 한 단계에 드는 것. 마지막 단계에 닿았으면 full이다. */
export function stepProgress(pass: Pass): { have: number; need: number; full: boolean } {
  const need = Math.max(1, pass.pointsPerStep)
  if (pass.step >= pass.steps.length) return { have: need, need, full: true }
  const have = Math.max(0, Math.min(need, pass.points - pass.step * need))
  return { have, need, full: false }
}

/** 단계의 상태: 받은 단계(claimed), 닿아서 받을 수 있는 단계(ready), 아직 못 닿은 단계(locked). */
export function stepState(step: PassStep): 'claimed' | 'ready' | 'locked' {
  if (step.claimed) return 'claimed'
  return step.reached ? 'ready' : 'locked'
}

/** 큰 보상 단계: 5의 배수 단계의 다이아 묶음, 무기·고양이가 붙는 단계. 보상표가 바뀌어도 따라가게 보상으로 가린다. */
export function milestone(step: PassStep): boolean {
  return step.weapon || step.cat || step.diamonds >= 200
}

/** 열었을 때 보여 줄 단계: 받을 수 있는 첫 단계, 없으면 지금 오르고 있는 다음 단계(다 올랐으면 마지막 단계). */
export function focusStep(pass: Pass): number {
  const ready = pass.steps.find((step) => stepState(step) === 'ready')
  if (ready) return ready.step
  return Math.max(1, Math.min(pass.steps.length, pass.step + 1))
}

/**
 * 미션의 진행도 (569번): 다음 문턱까지 "73/100". 문턱이 되풀이되므로 센 수는 그대로 적고, 막대는 지난 문턱부터 다음 문턱까지의 비율이다.
 */
export function missionProgress(mission: PassMission): { text: string; ratio: number } {
  const every = Math.max(1, mission.every)
  const from = mission.target - every
  return {
    text: `${mission.count.toLocaleString()}/${mission.target.toLocaleString()}`,
    ratio: Math.max(0, Math.min(1, (mission.count - from) / every)),
  }
}

/** 받은 무기의 이름: 가진 무기 목록에서 찾고, 없으면 등급만 적는다. */
function weaponName(reward: PassReward, weapons: Weapons): string {
  const held = weapons.find((w) => w.kind === reward.weaponKind && w.grade === reward.weaponGrade)
  return held ? `${held.name} ${held.gradeName}` : `${reward.weaponGrade ?? ''} 등급`.trim()
}

/**
 * 방금 받은 것을 한 줄로: "다이아 +250 · 무기 리볼버 S · 고양이 하늘냥". 다이아는 더하고, 무기·고양이는 이름을 적는다. 무기가 셋을 넘으면
 * "무기 4개"로 줄인다. 받은 것이 없으면 빈 글이다. 돈은 주지 않는다 (569번).
 */
export function rewardsText(rewards: PassReward[], weapons: Weapons = []): string {
  const diamonds = rewards.reduce((sum, r) => sum + r.diamonds, 0)
  const guns = rewards.filter((r) => r.weaponKind)
  const cats = rewards.filter((r) => r.cat)
  const parts: string[] = []
  if (diamonds > 0) parts.push(`다이아 +${diamondText(diamonds)}`)
  if (guns.length > 3) parts.push(`무기 ${guns.length}개`)
  else if (guns.length > 0) parts.push(`무기 ${guns.map((r) => weaponName(r, weapons)).join(', ')}`)
  if (cats.length > 0) parts.push(`고양이 ${cats.map((r) => r.catName ?? '한 마리').join(', ')}`)
  return parts.join(' · ')
}
