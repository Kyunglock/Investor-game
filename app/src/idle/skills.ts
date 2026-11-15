import type { Company } from '@web/api/client'

export type SkillCode = NonNullable<Company['idle']>['cats'][number]['skill']

/**
 * 고양이 고유 스킬의 설명 (decisions.md 501·515·530번): 하는 일(does)과 레벨이 오르면 달라지는 점(grows), 세 단계의
 * 모습(tiers, 스킬 Lv.1·2·3부터. 배지 그림도 이 단계를 따른다, 531번). 스킬은 고양이 레벨 10마다(Lv.10·20·30·40)
 * 한 레벨 오른다. 규칙은 mental/magic.ts에 있다.
 */
export const SKILLS: Record<
  SkillCode,
  { does: string; grows: string; tiers: [string, string, string] }
> = {
  water: {
    does: '물을 쏴 맞은 적을 느리게 해요',
    grows: '레벨이 오르면 물방울 → 물줄기 → 큰 물결, 더 자주·세게',
    tiers: ['물방울', '물줄기', '큰 물결'],
  },
  meteor: {
    does: '운석이 떨어져 둘레의 적을 한꺼번에 때리고 잠깐 멈춰 세워요',
    grows: '레벨이 오르면 운석 → 대운석 → 유성우, 더 자주·넓게',
    tiers: ['운석', '대운석', '유성우'],
  },
  bolt: {
    does: '번개가 내리꽂혀 옆의 적에게 튀어요',
    grows: '레벨이 오르면 번개가 굵어지고 더 많이 튀어요',
    tiers: ['가는 번개', '굵은 번개', '여러 갈래'],
  },
  ram: {
    does: '충차가 달려가 매도벽을 들이받아요 · 벽에만 피해를 줘요',
    grows: '레벨이 오르면 충차가 커지고 벽을 더 세게 들이받아요',
    tiers: ['돌 충차', '바위 충차', '대지 충차'],
  },
}
