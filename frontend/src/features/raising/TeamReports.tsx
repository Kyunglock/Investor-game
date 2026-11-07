import type { Company } from '../../api/client'
import { pnlLabel } from './board'
import { GradeBadge } from './GradeCard'

type Report = NonNullable<Company['lastQuarter']>['reports'][number]
type Employee = Company['employees'][number]

/**
 * 팀 실적과 팀장 보고 (decisions.md 269·356번). 돈을 굴리는 팀을 번 순서로 늘어놓고 손익 막대를 그린다. 팀장 보고는 **가장 많이 번 팀과 가장 적게 번
 * 팀, 둘만** 읽는다(전에는 자리마다 한 줄씩 길게 늘어졌다). 돕는 팀은 한 줄로 접는다. 분기 실적과 연말 결산서가 같이 쓴다.
 */
export function TeamReports({ reports, employees }: { reports: Report[]; employees?: Employee[] }) {
  const trading = reports.filter((r) => r.pnl != null).sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
  const support = reports.filter((r) => r.pnl == null)
  if (reports.length === 0) {
    return null
  }
  const best = trading[0]
  const worst = trading.length > 1 ? trading[trading.length - 1] : undefined
  const scale = Math.max(1, ...trading.map((r) => Math.abs(r.pnl ?? 0)))
  const gradeOf = (r: Report) => employees?.find((e) => e.id === r.leaderId)?.overallGrade
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
            return (
              <li
                key={r.desk}
                className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-[12px]"
                data-testid="team-bar"
                data-desk={r.desk}
              >
                <span className="truncate">
                  {mark && <span className="mr-0.5">{mark}</span>}
                  <b>{r.deskName}</b>
                  <span className="ml-1 text-muted">
                    {r.leader}
                    {gradeOf(r) && (
                      <span className="ml-0.5">
                        <GradeBadge grade={gradeOf(r) as Employee['overallGrade']} size="inline" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="relative h-3 overflow-hidden rounded bg-line-soft">
                  <span
                    className={`absolute inset-y-0 left-0 rounded ${tone}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <b
                  className={`font-mono-num ${pnl > 0 ? 'text-up' : pnl < 0 ? 'text-down' : 'text-muted'}`}
                >
                  {pnlLabel(pnl)}
                </b>
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
          돕는 팀 · {support.map((r) => `${r.deskName} ${r.leader}`).join(' · ')}
        </p>
      )}
    </section>
  )
}
