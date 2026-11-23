import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS, ACTIVE_NOTES, SKILL_CODES, SKILL_NAMES } from '../mental/actives'
import { heroOf } from '../mental/hero'
import { ActiveBadge } from './ActiveBadge'
import { CatPortrait, catTrait } from './CatPortrait'
import { CatRosterGrid } from './CatRosterGrid'
import { CompanionSkills } from './CompanionSkills'
import { sortCats } from './catGrade'

/** 스킬 탭: 사장냥의 스킬은 매도벽 돌파 스테이지의 레벨업 카드로 쓰고 (667번), 고양이를 고르면 그 고양이의 고유 스킬을 본다. */
export function IdleSkills({
  company,
  picked,
  onPick,
}: {
  company: Company
  picked: CatCode | null
  onPick: (code: CatCode | null) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const cats = sortCats(company.idle?.cats ?? [])
  const [preview, setPreview] = useState<CatCode | null>(null)
  const cat = cats.find((item) => item.code === (preview ?? picked))
  const pick = (code: CatCode | null) => {
    const locked = cats.some((item) => item.code === code && item.level < 1)
    setPreview(locked ? code : null)
    if (!locked) onPick(code)
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' }))
    sfx.tap()
  }
  const boss = heroOf(company).name
  const error = useRaisingStore((s) => s.error)
  return (
    <div ref={panel} className="boss-skills" data-testid="skills">
      {cat ? (
        <section className="companion-skills" aria-label={`${cat.name} 고유 스킬`}>
          <header>
            <CatPortrait code={cat.code} grade={cat.grade} />
            <div>
              <b>
                {cat.name} · {cat.grade} · {cat.level > 0 ? `Lv.${cat.level}` : '미보유'}
              </b>
              <p>
                무기 공격력의 {cat.damagePercent}% · {catTrait(cat)}
              </p>
            </div>
          </header>
          <CompanionSkills cat={cat} />
        </section>
      ) : (
        <>
          <section
            className="boss-skill-loadout"
            aria-label="스테이지 레벨업 카드"
            data-testid="skill-level"
          >
            <div className="boss-skill-header">
              <b>스테이지 레벨업 카드</b>
              <span>{SKILL_CODES.length + 1}종</span>
            </div>
            <p className="boss-skill-help">
              사장냥의 스킬은 매도벽 돌파 스테이지에서 써요. 스테이지에서 매도벽을 부숴 레벨이
              오르면 카드 석 장 가운데 한 장을 고르고, 아래 카드가 섞여 나와요. 고른 카드는 그
              판에서만 이어져요.
            </p>
          </section>
          <ul className="boss-skill-list" aria-label="레벨업 카드">
            {SKILL_CODES.map((code) => (
              <li key={code} data-testid="unique-skill" data-code={code}>
                <div className="boss-skill-main">
                  <span
                    className="boss-skill-art"
                    role="img"
                    aria-label={`${SKILL_NAMES[code]} · ${ACTIVE_NOTES[code]}`}
                  >
                    <ActiveBadge code={code} />
                  </span>
                  <div className="boss-skill-info">
                    <div className="boss-skill-title">
                      <b>{SKILL_NAMES[code]}</b>
                    </div>
                    <p>
                      {ACTIVE_HINTS[code]} · {code === 'stopLoss' ? '바로 발동' : '1분 동안'}
                    </p>
                  </div>
                </div>
                <details className="boss-skill-details">
                  <summary aria-label={`${SKILL_NAMES[code]} 설명`}>
                    효과 자세히{' '}
                    <span className="boss-skill-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </summary>
                  <p>{ACTIVE_NOTES[code]}</p>
                </details>
              </li>
            ))}
            <li data-testid="unique-skill" data-code="cat-up">
              <div className="boss-skill-main">
                <span className="boss-skill-art boss-skill-magic" aria-hidden="true">
                  ✦
                </span>
                <div className="boss-skill-info">
                  <div className="boss-skill-title">
                    <b>고양이 마법 강화</b>
                  </div>
                  <p>함께 싸우는 고양이 모두가 마법을 쓰고 · 배운 마법 레벨 +1</p>
                </div>
              </div>
            </li>
          </ul>
        </>
      )}
      <button
        type="button"
        className="skill-boss-picker"
        aria-pressed={!cat}
        onClick={() => pick(null)}
      >
        <CatPortrait /> {boss} 스킬
      </button>
      <CatRosterGrid cats={cats} picked={cat?.code ?? null} onPick={pick} preview />
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
