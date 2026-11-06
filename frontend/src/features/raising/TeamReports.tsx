import type { Company } from '../../api/client'
import { pnlLabel } from './board'

type Report = NonNullable<Company['lastQuarter']>['reports'][number]

/**
 * 팀장 보고 (decisions.md 269번). 자리마다 팀장이 사장에게 한 줄씩 보고한다: 돈을 굴리는 팀은 팀 손익과 손을 뒤집은 팀원, 돕는 팀은 한 일. 분기 실적과 연말
 * 결산서가 같이 쓴다.
 */
export function TeamReports({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return null
  }
  return (
    <section className="mt-3" data-testid="team-reports">
      <h3 className="text-[14px] font-semibold">팀장 보고</h3>
      <ul className="mt-1 grid gap-1.5">
        {reports.map((r) => (
          <li
            key={r.desk}
            className="rounded border-l-4 border-gold bg-line-soft/40 py-1 pr-2 pl-2.5"
            data-testid="team-report"
          >
            <p className="flex items-baseline justify-between gap-2 text-[12px] text-muted">
              <span>{r.head}</span>
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
    </section>
  )
}
