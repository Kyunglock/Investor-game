import type { Company } from '@web/api/client'
import { EXTRA_SPELLS, type ExtraSpell, SPELLBOOK } from '../mental/spellbook'

export type SkillCode = NonNullable<Company['idle']>['cats'][number]['skills'][number]['code']

/**
 * 고양이 고유 스킬의 설명 (decisions.md 501·515·530번): 하는 일(does)과 레벨이 오르면 달라지는 점(grows), 세 단계의
 * 모습(tiers, 스킬 Lv.1·2·3부터. 배지 그림도 이 단계를 따른다, 531번). 스킬은 고양이 레벨 10마다(Lv.10·20·30·40)
 * 한 레벨 오른다. 규칙은 mental/magic.ts에 있다. 스킬은 A등급 고양이부터 있고 S등급은 둘이다 (561번).
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
  // 얼음·바람 (561번).
  ice: {
    does: '얼음 창이 곧게 날아가 지나가는 적을 꿰뚫고 잠깐 얼려요',
    grows: '레벨이 오르면 창이 굵어지고 더 세게·오래 얼려요',
    tiers: ['얼음 조각', '얼음 창', '눈꽃 창'],
  },
  wind: {
    does: '넓은 돌풍이 쓸고 가며 적을 뒤로 밀어내요',
    grows: '레벨이 오르면 돌풍이 넓어지고 더 자주·멀리 밀어내요',
    tiers: ['산들바람', '돌풍', '회오리'],
  },
  // spellbook의 마법들 (563번): 설명은 표에 있다.
  ...(Object.fromEntries(
    EXTRA_SPELLS.map((spell) => {
      const { does, grows, tiers } = SPELLBOOK[spell]
      return [spell, { does, grows, tiers }]
    }),
  ) as Record<ExtraSpell, { does: string; grows: string; tiers: [string, string, string] }>),
}

/** 고양이가 가진 스킬 이름들 (561번): "얼음 스킬·물 스킬". 스킬이 없으면(C·B등급) 빈 글자다. */
export function skillNames(cat: { skills: readonly { name: string }[] }): string {
  return cat.skills.map((skill) => skill.name).join('·')
}
