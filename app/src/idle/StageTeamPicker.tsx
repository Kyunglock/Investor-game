import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useState } from 'react'
import { sfx } from '../fx/sound'
import { CatPortrait } from './CatPortrait'
import { sortCats } from './catGrade'
import { readStageTeam, STAGE_TEAM_MAX, saveStageTeam, stageTeamOf } from './stageTeam'
import './stage-team.css'

/**
 * 스테이지 출전 고양이 고르기 (decisions.md 669번). 위의 세 칸이 나올 차례다: 스테이지에서 고양이 카드를 고를 때마다 1번부터 나온다. 칸을
 * 누르면 빼고, 아래 목록에서 누르면 빈 칸에 넣는다. 고른 것은 이 기기에 저장한다.
 */
export function StageTeamPicker({ company }: { company: Company }) {
  const [saved, setSaved] = useState(() => readStageTeam(company.companyId))
  const cats = sortCats(company.idle?.cats ?? []).filter((cat) => cat.level > 0)
  const team = stageTeamOf(company, saved)
  const full = team.length >= STAGE_TEAM_MAX
  const set = (codes: string[]) => {
    sfx.tap()
    saveStageTeam(company.companyId, codes)
    setSaved(codes)
  }
  const of = (code: string) => cats.find((cat) => cat.code === code)
  const skillText = (cat: (typeof cats)[number]) =>
    cat.skills.length ? cat.skills.map((s) => s.name).join('·') : '스킬 없음'
  return (
    <section className="stage-team" data-testid="stage-team" aria-label="스테이지 출전 고양이">
      <header>
        <b>출전 고양이</b>
        <span role="status">
          {team.length} / {STAGE_TEAM_MAX}
        </span>
      </header>
      <p className="stage-team-help">
        스테이지에서 고양이 카드를 고르면 1번부터 차례로 나와요. 나온 고양이는 제 고유 스킬을 쓰고,
        스킬 강화 카드로 레벨을 올려요.
      </p>
      <ol className="stage-team-slots">
        {Array.from({ length: STAGE_TEAM_MAX }, (_, i) => team[i] ?? null).map((code, i) => {
          const cat = code ? of(code) : undefined
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: 칸은 자리 번호가 곧 열쇠다.
            <li key={i} data-testid="stage-team-slot" data-code={cat?.code}>
              {cat ? (
                <button
                  type="button"
                  aria-label={`${i + 1}번 ${cat.name} 빼기`}
                  onClick={() => set(team.filter((c) => c !== cat.code))}
                >
                  <i className="stage-team-order">{i + 1}</i>
                  <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                  <b className="stage-team-name">{cat.name}</b>
                  <small className="stage-team-skill">{skillText(cat)}</small>
                  <span className="stage-team-remove" aria-hidden="true">
                    ×
                  </span>
                </button>
              ) : (
                <div className="stage-team-empty">
                  <i className="stage-team-order">{i + 1}</i>
                  <small className="stage-team-skill">빈 칸</small>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {cats.length === 0 ? (
        <p className="stage-team-help">아직 고양이가 없어요. 상점에서 뽑으면 데려갈 수 있어요.</p>
      ) : (
        <ul className="stage-team-roster" aria-label="가진 고양이">
          {cats.map((cat) => {
            const at = team.indexOf(cat.code)
            const on = at >= 0
            return (
              <li key={cat.code}>
                <button
                  type="button"
                  data-testid="stage-team-cat"
                  data-code={cat.code}
                  aria-pressed={on}
                  aria-label={`${cat.name} · ${cat.grade}등급 · ${skillText(cat)}${
                    on ? ` · ${at + 1}번으로 출전` : full ? ' · 칸 없음' : ''
                  }`}
                  disabled={!on && full}
                  onClick={() => set(on ? team.filter((c) => c !== cat.code) : [...team, cat.code])}
                >
                  <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                  {on && <i className="stage-team-order">{at + 1}</i>}
                  <span>{cat.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
