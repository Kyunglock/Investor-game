import { ActiveBadge } from '../idle/ActiveBadge'
import { CatPortrait } from '../idle/CatPortrait'
import { SkillBadge } from '../idle/SkillBadge'
import { type Card, isSkillCard } from './cards'

const TILE = { atk: 6, spd: 7, cat: 8, 'cat-magic': 9, 'cat-skill': 10, 'cat-up': 11 }
const MAGIC_SKILL = { water: 'water', meteor: 'meteor', lightning: 'bolt', earth: 'ram' } as const

export function StageSkillIcon({ card }: { card: Card }) {
  const { code, cat } = card
  if (code === 'cat' && cat) return <CatPortrait code={cat.code} grade={cat.grade} />
  if (code === 'cat-skill' && cat?.skills.length) {
    return (
      <span className="stage-cat-skills" aria-hidden="true">
        {cat.skills.map((skill) => (
          <SkillBadge
            key={skill.code}
            skill={skill.code}
            level={card.level?.to}
            size={cat.skills.length > 1 ? 22 : 40}
          />
        ))}
      </span>
    )
  }
  if (isSkillCard(code)) return <ActiveBadge code={code} />
  if (code === 'water' || code === 'meteor' || code === 'lightning' || code === 'earth')
    return <SkillBadge skill={MAGIC_SKILL[code]} level={card.level?.to} size={40} />
  const tile = TILE[code]
  return (
    <span
      aria-hidden="true"
      className="stage-skill-icon"
      style={{
        backgroundPosition: `${((tile % 4) * 100) / 3}% ${(Math.floor(tile / 4) * 100) / 3}%`,
      }}
    />
  )
}
