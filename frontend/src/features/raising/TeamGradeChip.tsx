import type { Company } from '../../api/client'
import { GradeBadge } from './GradeCard'

export type TeamGrade = NonNullable<NonNullable<Company['invest']>['team']>

/** 팀 합산 등급 칩 (decisions.md 353번): 회의에 앉은 팀의 등급·점수·사람 수와 한 줄 풀이. 앉은 사람이 없으면 아무것도 없다. */
export function TeamGradeChip({ team }: { team: TeamGrade | null | undefined }) {
  if (!team) {
    return null
  }
  return (
    <p
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-line-soft bg-line-soft/40 px-2 py-1 text-[13px]"
      data-testid="team-grade"
      data-grade={team.grade}
    >
      <span className="text-[12px] text-muted">팀 합산</span>
      <GradeBadge grade={team.grade} size="inline" />
      <span className="font-mono-num text-[12px] text-muted">
        {team.score}점 · {team.members}명
      </span>
      <span className="text-ink">{team.hint}</span>
    </p>
  )
}
