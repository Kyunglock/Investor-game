import type { Company } from '@web/api/client'
import { magicTier } from '../mental/magic'
import { SkillBadge } from './SkillBadge'
import { SKILLS } from './skills'

type Cat = NonNullable<Company['idle']>['cats'][number]

export function CompanionSkills({ cat }: { cat: Cat }) {
  if (cat.skills.length === 0)
    return (
      <p className="idle-cat-noskill" data-testid="cat-noskill">
        고유 스킬 없음 · 스킬은 A등급 고양이부터 있어요
      </p>
    )
  return (
    <>
      {cat.skills.map((own) => {
        const skill = SKILLS[own.code]
        return (
          <section
            key={own.code}
            className="idle-cat-skill"
            data-testid="cat-skill"
            data-skill={own.code}
          >
            <SkillBadge skill={own.code} level={cat.skillLevel} size={60} />
            <div className="idle-skill-text">
              <b className="idle-skill-title">
                고유 스킬 {own.name} <small className="idle-skill-lv">Lv.{cat.skillLevel}</small>
              </b>
              <p className="idle-skill-line">{skill.does}</p>
              <p className="idle-skill-line">{skill.grows}</p>
              {/* 레벨에 따라 바뀌는 모습 (531번): 지금 단계에 테를 두른다. */}
              <ol className="idle-skill-tiers" aria-label="레벨에 따라 바뀌는 모습">
                {skill.tiers.map((name, i) => {
                  const now = magicTier(cat.skillLevel) === i + 1
                  return (
                    <li
                      key={name}
                      className={`idle-skill-tier ${now ? 'is-now' : ''}`}
                      aria-current={now || undefined}
                    >
                      <SkillBadge skill={own.code} level={i + 1} size={24} />
                      {name}
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>
        )
      })}
      <p className="idle-skill-line idle-skill-next" data-testid="cat-skill-next">
        {cat.level < 1
          ? '고양이를 획득하면 스킬을 사용할 수 있어요'
          : cat.skillNextLevel > 0
            ? `고양이 Lv.${cat.skillNextLevel}에 스킬 Lv.${cat.skillLevel + 1} · 앞으로 ${cat.skillNextLevel - cat.level}레벨`
            : '스킬 최고 레벨이에요'}
      </p>
      <p className="idle-skill-line">
        {cat.fielded ? '출전 중이라 발동하고 있어요' : '출전하면 발동해요'}
      </p>
    </>
  )
}
