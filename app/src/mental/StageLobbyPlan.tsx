import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { CatPortrait } from '../idle/CatPortrait'
import { SkillBadge } from '../idle/SkillBadge'
import { stageTeamOf } from '../idle/stageTeam'

type Cat = NonNullable<Company['idle']>['cats'][number]

/**
 * 출전 화면의 출전 고양이 줄 (decisions.md 681번): 고양이 카드를 고를 때마다 나올 고양이를 출전 칸의 차례대로 보인다(669번).
 * 사장냥이 쉬면(672번) 맨 앞 고양이는 처음부터 나온다.
 */
export function StageLobbyTeam({ company }: { company: Company }) {
  const owned = company.idle?.cats ?? []
  const team = stageTeamOf(company).flatMap((code) => owned.filter((c) => c.code === code))
  const benched = company.idle?.bossFielded === false && team.length > 0
  return (
    <section className="stage-lobby-team" data-testid="stage-lobby-team" aria-label="출전 고양이">
      <header>
        <b>출전 고양이</b>
        <span>{benched ? '사장냥은 쉬어요' : '고양이 카드를 고르면 차례로 나와요'}</span>
      </header>
      {team.length === 0 ? (
        <p className="stage-lobby-team-empty">출전한 고양이가 없어요 · 사장냥 혼자 싸워요</p>
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
    </section>
  )
}
