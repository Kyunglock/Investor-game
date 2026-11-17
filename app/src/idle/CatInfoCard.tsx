import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useEffect, useState } from 'react'
import { sfx } from '../fx/sound'
import { DEFAULT_WEAPON, heroOf } from '../mental/hero'
import { CatPortrait, catTrait } from './CatPortrait'
import { SkillBadge } from './SkillBadge'
import { SKILLS } from './skills'
import './cat-info.css'

/**
 * 고양이 정보 (decisions.md 605번): 전투 화면에서 고양이를 누르면 뜬다. 등급·레벨·총의 세기·고유 스킬·든 무기를 보여 준다. 사장냥('boss')도
 * 같다. 바깥을 누르거나 닫기를 누르면 닫힌다. 고양이·무기 탭으로 가는 단추가 있다.
 */
export function CatInfoCard({
  company,
  onManage,
}: {
  company: Company
  /** 고양이·무기 탭을 그 고양이로 연다. 사장냥은 null. */
  onManage: (code: CatCode | null) => void
}) {
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    const show = (event: Event) => {
      sfx.tap()
      setCode((event as CustomEvent<string>).detail)
    }
    window.addEventListener('idle-cat-info', show)
    return () => window.removeEventListener('idle-cat-info', show)
  }, [])
  useEffect(() => {
    if (!code) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCode(null)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [code])
  if (!code) return null
  const cat = company.idle?.cats.find((c) => c.code === code && c.level > 0) ?? null
  if (!cat && code !== 'boss') return null
  const hero = heroOf(company)
  const held = cat
    ? (company.weapons?.find((w) => w.kind === cat.weapon?.kind && w.grade === cat.weapon.grade) ??
      DEFAULT_WEAPON)
    : hero.weapon
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 바깥을 누르면 닫히는 막이다. 닫기 단추와 Esc가 따로 있다.
    // biome-ignore lint/a11y/useKeyWithClickEvents: 위와 같다.
    <div
      className="cat-info-veil"
      onClick={(event) => {
        if (event.target === event.currentTarget) setCode(null)
      }}
    >
      <section
        className={`cat-info-card is-${cat?.grade ?? 'boss'}`}
        role="dialog"
        aria-label={`${cat?.name ?? hero.name} 정보`}
        data-testid="cat-info"
        data-code={code}
      >
        <header>
          <span className="cat-info-face">
            <CatPortrait code={cat ? (cat.code as CatCode) : undefined} />
          </span>
          <div>
            <b>
              <em className={`cat-info-grade is-${cat?.grade ?? 'boss'}`}>
                {cat ? cat.grade : '사장'}
              </em>{' '}
              {cat?.name ?? hero.name} {cat && <small>Lv.{cat.level}</small>}
            </b>
            <small>
              {cat
                ? `무기 공격력의 ${cat.damagePercent}%로 쏴요 · ${catTrait(cat)}`
                : '늘 맨 앞에서 싸워요'}
            </small>
          </div>
        </header>
        <dl>
          <div>
            <dt>무기</dt>
            <dd>
              {held.name} {held.gradeName}
            </dd>
          </div>
        </dl>
        <section className="cat-info-skills" aria-label="고유 스킬">
          <h3>고유 스킬</h3>
          {cat && cat.skills.length > 0 ? (
            <>
              {cat.skills.map((own) => (
                <div className="cat-info-skill" key={own.code} data-testid="cat-info-skill">
                  <SkillBadge skill={own.code} level={cat.skillLevel} size={40} />
                  <div className="cat-info-skill-text">
                    <b className="cat-info-skill-title">
                      {own.name} <small className="cat-info-skill-level">Lv.{cat.skillLevel}</small>
                    </b>
                    <p>{SKILLS[own.code].does}</p>
                    <p className="cat-info-growth">{SKILLS[own.code].grows}</p>
                  </div>
                </div>
              ))}
              <p className="cat-info-next">
                {cat.skillNextLevel > 0
                  ? `고양이 Lv.${cat.skillNextLevel}에 스킬 Lv.${cat.skillLevel + 1}`
                  : '스킬 최고 레벨이에요'}
              </p>
            </>
          ) : (
            <p className="cat-info-empty">
              {cat
                ? '고유 스킬은 A등급 고양이부터 있어요.'
                : '사장냥은 고유 스킬 없이 장착한 무기로 싸워요.'}
            </p>
          )}
        </section>
        <footer>
          <button
            type="button"
            onClick={() => {
              setCode(null)
              onManage(cat ? (cat.code as CatCode) : null)
            }}
            data-testid="cat-info-manage"
          >
            고양이·무기 탭에서 보기
          </button>
          <button type="button" onClick={() => setCode(null)} data-testid="cat-info-close">
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}
