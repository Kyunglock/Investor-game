import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useState } from 'react'
import { CatFilters, DEFAULT_CAT_FILTER, filterCats } from '../idle/CatFilters'
import { CatPortrait } from '../idle/CatPortrait'
import { CatRosterGrid } from '../idle/CatRosterGrid'
import { catDps } from '../idle/party'
import { SkillBadge } from '../idle/SkillBadge'
import { STAGE_TEAM_MAX } from './cards'

type Cat = NonNullable<Company['idle']>['cats'][number]

/**
 * 출전 화면의 출전 고양이 줄 (decisions.md 681번): 고양이 카드를 고를 때마다 나올 고양이를 출전 칸의 차례대로 보인다(669번).
 * 사장냥이 쉬면(672번) 맨 앞 고양이는 처음부터 나온다.
 */
export function StageLobbyTeam({
  company,
  codes,
  onChange,
}: {
  company: Company
  codes: string[]
  onChange: (codes: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState({ ...DEFAULT_CAT_FILTER, sort: 'grade' })
  const capacity = Math.min(company.idle?.fieldSlots ?? 0, STAGE_TEAM_MAX)
  const owned = company.idle?.cats ?? []
  const team = codes.flatMap((code) => owned.filter((c) => c.code === code))
  const benched = company.idle?.bossFielded === false && team.length > 0
  const visible = editing
    ? filterCats(
        owned
          .filter((cat) => cat.level > 0)
          .map((cat) => ({ ...cat, fielded: codes.includes(cat.code) })),
        filter,
        codes,
        (code) => catDps(company, code as CatCode),
      )
    : []
  return (
    <section className="stage-lobby-team" data-testid="stage-lobby-team" aria-label="출전 고양이">
      <header>
        <b>출전 고양이</b>
        <span>{benched ? '사장냥은 쉬어요' : `${team.length}마리`}</span>
      </header>
      {team.length === 0 ? (
        <p className="stage-lobby-team-empty">사장냥 단독 출전</p>
      ) : (
        <ol>
          {team.map((cat: Cat, i) => (
            <li key={cat.code} data-testid="stage-lobby-cat" data-code={cat.code}>
              <em className="stage-lobby-team-order">{i + 1}</em>
              <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
              <b>{cat.name}</b>
              {/* 고유 스킬은 그림으로만 (스테이지에서는 Lv.1부터 쓴다, 669번). C·B등급은 스킬이 없어 비운다. */}
              <span className="stage-lobby-team-skills">
                {cat.skills.map((s) => (
                  <SkillBadge key={s.code} skill={s.code} size={20} label={s.name} />
                ))}
              </span>
              {benched && i === 0 && <small>처음부터</small>}
            </li>
          ))}
        </ol>
      )}
      {capacity > 0 && owned.some((cat) => cat.level > 0) && (
        <button
          type="button"
          className="stage-edit-team"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          {editing ? '편성 완료' : '스테이지 출전 편성'}
        </button>
      )}
      {editing && (
        <div className="stage-team-editor">
          <CatFilters value={filter} onChange={setFilter} count={visible.length} />
          <p>
            이번 판 출전 {codes.length}/{capacity} ·{' '}
            {codes.length >= capacity
              ? '교체하려면 출전 중인 고양이를 먼저 빼세요.'
              : '카드를 눌러 추가하거나 빼세요.'}
          </p>
          {visible.length ? (
            <CatRosterGrid
              readable
              cats={visible}
              picked={null}
              disabledCat={(cat) => !cat.fielded && codes.length >= capacity}
              onPick={(code) =>
                onChange(
                  codes.includes(code)
                    ? codes.filter((current) => current !== code)
                    : [...codes, code],
                )
              }
            />
          ) : (
            <p className="roster-no-results">조건에 맞는 고양이가 없어요.</p>
          )}
        </div>
      )}
    </section>
  )
}
