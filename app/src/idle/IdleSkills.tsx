import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { CatPortrait, catTrait } from './CatPortrait'
import { CatRosterGrid } from './CatRosterGrid'
import { CompanionSkills } from './CompanionSkills'
import { sortCats } from './catGrade'

/**
 * 스킬 탭: 고양이의 고유 스킬을 본다. 스테이지 카드의 설명과 목록은 없앴다 (674번): 카드는 스테이지에서 고를 때 설명이 나온다. 고양이
 * 목록에서 고양이를 누르면 그 고양이의 상세 보기로 넘어간다 (668번): 목록은 가리고 그 고양이의 정보와 고유 스킬만 보이며, 위의 "스킬 목록"
 * 단추로 돌아온다.
 */
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
  const error = useRaisingStore((s) => s.error)
  return (
    <div ref={panel} className="boss-skills" data-testid="skills">
      {cat ? (
        <section
          className="companion-skills"
          aria-label={`${cat.name} 고유 스킬`}
          data-testid="skill-cat-detail"
          data-code={cat.code}
        >
          <button
            type="button"
            className="skill-back"
            data-testid="skill-back"
            onClick={() => pick(null)}
          >
            <span aria-hidden="true">‹</span> 스킬 목록
          </button>
          <header>
            <CatPortrait code={cat.code} grade={cat.grade} />
            <div>
              <b>{cat.name}</b>
              <span className="skill-cat-chips">
                <i>{cat.grade}등급</i>
                <i>{cat.level > 0 ? `Lv.${cat.level}` : '미보유'}</i>
                {cat.fielded && <i className="is-fielded">출전 중</i>}
              </span>
              <p>
                무기 공격력의 {cat.damagePercent}% · {catTrait(cat)}
              </p>
            </div>
          </header>
          <CompanionSkills cat={cat} />
        </section>
      ) : (
        <>
          <div className="boss-skill-header">
            <b>고양이 고유 스킬</b>
            <span>눌러서 상세 보기</span>
          </div>
          <CatRosterGrid cats={cats} picked={null} onPick={pick} preview />
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
