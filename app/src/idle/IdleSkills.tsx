import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS, ACTIVE_NOTES, SKILL_CODES, SKILL_NAMES } from '../mental/actives'
import { ActiveBadge } from './ActiveBadge'
import { CatPortrait, catTrait } from './CatPortrait'
import { CatRosterGrid } from './CatRosterGrid'
import { CompanionSkills } from './CompanionSkills'
import { sortCats } from './catGrade'

/**
 * 스킬 탭: 사장냥의 스킬은 매도벽 돌파 스테이지의 레벨업 카드로 쓴다 (667번). 아래 고양이 목록에서 고양이를 누르면 그 고양이의 상세 보기로
 * 넘어간다 (668번): 목록은 가리고 그 고양이의 정보와 고유 스킬만 보이며, 위의 "스킬 목록" 단추로 돌아온다.
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
            <li data-testid="unique-skill" data-code="cat-skill">
              <div className="boss-skill-main">
                <span className="boss-skill-art boss-skill-magic" aria-hidden="true">
                  ✦
                </span>
                <div className="boss-skill-info">
                  <div className="boss-skill-title">
                    <b>고양이 스킬 강화</b>
                  </div>
                  <p>스테이지에 나온 고양이의 고유 스킬 레벨 +1 · 최고 Lv.5</p>
                </div>
              </div>
            </li>
          </ul>
        </>
      )}
      {!cat && (
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
