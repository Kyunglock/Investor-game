import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS, ACTIVE_NOTES } from '../mental/actives'
import { heroOf } from '../mental/hero'
import { ActiveBadge } from './ActiveBadge'
import { CatPortrait, catTrait } from './CatPortrait'
import { CatRosterGrid } from './CatRosterGrid'
import { CompanionSkills } from './CompanionSkills'
import { sortCats } from './catGrade'

/** 스킬 탭: 사장냥의 고유 스킬은 레벨업 카드로 켜고 (667번), 고양이를 고르면 그 고양이의 고유 스킬을 본다. */
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
  const unique = (company.idle?.actives ?? []).filter((active) => !active.ad)
  const level = company.idle?.levelUp
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
          <section className="boss-skill-loadout" aria-label="전투 레벨" data-testid="skill-level">
            <div className="boss-skill-header">
              <b>전투 레벨 Lv.{level?.level ?? 1}</b>
              <span>
                경험치 {level?.xp ?? 0} / {level?.next ?? 0}
              </span>
            </div>
            <p className="boss-skill-help">
              매도벽을 부수면 경험치가 올라요. 레벨이 오를 때마다 아래 카드 석 장 가운데 한 장을
              골라요. 환생하면 레벨과 고른 카드가 처음으로 돌아가요.
              {level?.magicBonus ? ` 지금 고양이 마법 +${level.magicBonus}.` : ''}
            </p>
          </section>
          <div className="boss-skill-header">
            <b>레벨업 카드</b>
            <span>{unique.length + 1}종</span>
          </div>
          <ul className="boss-skill-list" aria-label="레벨업 카드">
            {unique.map((active) => (
              <li
                key={active.code}
                className={active.left > 0 ? 'is-equipped' : ''}
                data-testid="unique-skill"
                data-code={active.code}
              >
                <div className="boss-skill-main">
                  <span
                    className="boss-skill-art"
                    role="img"
                    aria-label={`${active.name} · ${ACTIVE_NOTES[active.code]}`}
                  >
                    <ActiveBadge code={active.code} />
                  </span>
                  <div className="boss-skill-info">
                    <div className="boss-skill-title">
                      <b>{active.name}</b>
                      {active.left > 0 && (
                        <span className="boss-skill-status">{Math.ceil(active.left)}초 남음</span>
                      )}
                    </div>
                    <p>
                      {ACTIVE_HINTS[active.code]} ·{' '}
                      {active.seconds > 0
                        ? `${Math.round(active.seconds / 60)}분 동안`
                        : '바로 발동'}
                    </p>
                  </div>
                </div>
                <details className="boss-skill-details">
                  <summary aria-label={`${active.name} 설명`}>
                    효과 자세히{' '}
                    <span className="boss-skill-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </summary>
                  <p>{ACTIVE_NOTES[active.code]}</p>
                </details>
              </li>
            ))}
            <li data-testid="unique-skill" data-code="catMagic">
              <div className="boss-skill-main">
                <span className="boss-skill-art level-card-magic" aria-hidden="true">
                  ✦
                </span>
                <div className="boss-skill-info">
                  <div className="boss-skill-title">
                    <b>고양이 마법 강화</b>
                    {!!level?.magicBonus && (
                      <span className="boss-skill-status">+{level.magicBonus}</span>
                    )}
                  </div>
                  <p>출전한 고양이 모두의 마법 레벨 +1 · 최고 Lv.5</p>
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
