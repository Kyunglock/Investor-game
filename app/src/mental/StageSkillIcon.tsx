import type { CardCode } from './cards'

const TILE = {
  barrage: 0,
  rally: 1,
  fortify: 2,
  limitUp: 3,
  stopLoss: 4,
  averaging: 5,
  atk: 6,
  spd: 7,
  cat: 8,
  'cat-magic': 9,
  'cat-skill': 10,
  'cat-up': 11,
  water: 12,
  meteor: 13,
  lightning: 14,
  earth: 15,
} satisfies Record<CardCode, number>

export function StageSkillIcon({ code }: { code: CardCode }) {
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
