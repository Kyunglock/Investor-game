import type { Company } from '../../api/client'
import { pnlLabel } from './board'
import { GradeBadge, MemberGrades } from './GradeCard'
import { teamGrades } from './grades'

type Report = NonNullable<Company['lastQuarter']>['reports'][number]
type Employee = Company['employees'][number]

/**
 * 팀 실적과 팀장 보고 (decisions.md 269·356·397번). 돈을 굴리는 팀을 번 순서로 늘어놓고 손익 막대를 그린다. 팀마다 팀장 등급은 눈에 띄는 방패로,
 * 팀원 등급은 작은 방패 줄로 붙인다(지금 그 자리에 앉은 사람). 팀장 보고는 **가장 많이 번 팀과 가장 적게 번 팀, 둘만** 읽는다(전에는 자리마다 한 줄씩
 * 길게 늘어졌다). 돕는 팀은 한 줄로 접는다. 분기 실적과 연말 결산서가 같이 쓴다.
 */
export function TeamReports({ reports, employees }: { reports: Report[]; employees: Employee[] }) {
  const trading = reports.filter((r) => r.pnl != null).sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
  const support = reports.filter((r) => r.pnl == null)
  if (reports.length === 0) {
    return null
  }
  const best = trading[0]
  const worst = trading.length > 1 ? trading[trading.length - 1] : undefined
  const scale = Math.max(1, ...trading.map((r) => Math.abs(r.pnl ?? 0)))
  const gradesOf = (r: Report) =>
    teamGrades(
      employees,
      r.leaderId,
      employees.filter((e) => e.desk === r.desk).map((e) => e.id),
    )
  const total = trading.reduce((sum, r) => sum + (r.pnl ?? 0), 0)
  return (
    <section className="mt-3" data-testid="team-reports">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold">팀 실적</h3>
        {trading.length > 0 && (
          <b
            className={`font-mono-num text-[13px] ${total > 0 ? 'text-up' : total < 0 ? 'text-down' : 'text-muted'}`}
            data-testid="team-total"
          >
            합계 {pnlLabel(total)}
          </b>
        )}
      </div>
      {trading.length > 0 && (
        <ul className="mt-1 grid gap-1" data-testid="team-bars">
          {trading.map((r) => {
            const pnl = r.pnl ?? 0
            const width = Math.round((Math.abs(pnl) / scale) * 100)
            const tone = pnl > 0 ? 'bg-up' : pnl < 0 ? 'bg-down' : 'bg-line-soft'
            const mark = r === best ? '🏆' : r === worst ? '🫠' : ''
            const grades = gradesOf(r)
            return (
              <li
                key={r.desk}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-[12px]"
                data-testid="team-bar"
                data-desk={r.desk}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {mark && <span>{mark}</span>}
                  <b>{r.deskName}</b>
                  <span className="whitespace-nowrap text-muted">
                    {grades.leader && <GradeBadge grade={grades.leader} size="md" />}
                    {r.leader}
                  </span>
                  <MemberGrades grades={grades.members} />
                </span>
                <b
                  className={`font-mono-num ${pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-muted'}`}
                >
                  {pnlLabel(pnl)}
                </b>
                <span className="relative col-span-2 h-2.5 overflow-hidden rounded bg-line-soft">
                  <span
                    className={`absolute inset-y-0 left-0 rounded ${tone}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {/* 팀장 보고 둘: 가장 많이 번 팀, 가장 적게 번 팀 (356번). */}
      <ul className="mt-2 grid gap-1.5">
        {[best, worst]
          .filter((r): r is Report => r !== undefined)
          .map((r) => (
            <li
              key={r.desk}
              className={`rounded border-l-4 bg-line-soft/40 py-1 pr-2 pl-2.5 ${r === best ? 'border-gold' : 'border-down'}`}
              data-testid="team-report"
              data-rank={r === best ? 'best' : 'worst'}
            >
              <p className="flex items-baseline justify-between gap-2 text-[12px] text-muted">
                <span>
                  <b className="mr-1 text-ink">
                    {r === best ? '가장 많이 번 팀' : '가장 적게 번 팀'}
                  </b>
                  {r.head}
                </span>
                {r.pnl != null && (
                  <b
                    className={`font-mono-num text-[13px] ${
                      r.pnl > 0 ? 'text-up' : r.pnl < 0 ? 'text-down' : 'text-muted'
                    }`}
                  >
                    {pnlLabel(r.pnl)}
                  </b>
                )}
              </p>
              <p className="text-[13px]">“{r.text}”</p>
            </li>
          ))}
      </ul>
      {support.length > 0 && (
        <p className="mt-1.5 text-[12px] text-muted" data-testid="team-support">
          돕는 팀
          {support.map((r) => {
            const leader = gradesOf(r).leader
            return (
              <span key={r.desk}>
                {' · '}
                {r.deskName} {leader && <GradeBadge grade={leader} size="inline" />}
                {r.leader}
              </span>
            )
          })}
        </p>
      )}
    </section>
  )
}
