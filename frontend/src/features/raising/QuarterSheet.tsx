import type { Company } from '../../api/client'
import { money } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { pnlLabel } from './board'
import { TeamReports } from './TeamReports'
import { STANCES } from './YearEnd'

type Quarter = NonNullable<Company['lastQuarter']>

const tone = (amount: number) => (amount > 0 ? 'text-up' : amount < 0 ? 'text-down' : 'text-muted')

/**
 * 분기 실적 (decisions.md 268번, #330). 1~3분기를 넘기면 짧게 뜬다: 자본이 얼마에서 얼마가 됐는지, 그 분기 태도, 직원 소식 한두 줄. 등급·건물·자리 수는
 * 연말에만 바뀌므로 여기에는 없다. 4분기를 넘기면 이 대신 연말 결산서가 뜬다.
 */
export function QuarterSheet({ quarter: q, onClose }: { quarter: Quarter; onClose: () => void }) {
  const change = q.capitalAfter - q.capitalBefore
  return (
    <Overlay>
      <section
        className={`animate-pop rounded bg-card p-5 shadow-xl ${q.crash ? 'animate-shake' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="분기 실적"
        data-testid="quarter-sheet"
      >
        <h2 className="font-pen text-[24px] leading-tight">
          {q.year}년 차 {q.quarter}분기 실적
          {q.stance && (
            <span className="ml-2 rounded bg-ink px-1.5 align-middle font-sans text-[12px] text-white">
              {STANCES[q.stance]}
            </span>
          )}
        </h2>
        {q.crash && (
          <p className="mt-1 text-[15px] font-bold text-red-pen" data-testid="quarter-crash">
            ⚡ 폭락이 터졌다
          </p>
        )}
        <p className="mt-2 flex items-baseline justify-between font-mono-num text-[16px]">
          <span>
            {money(q.capitalBefore)} → <b>{money(q.capitalAfter)}</b>
          </span>
          <b className={tone(change)} data-testid="quarter-change">
            {pnlLabel(change)}
          </b>
        </p>
        <ul className="mt-1 grid gap-0.5 text-[12px] text-muted">
          <li>직원들 {pnlLabel(q.staff)}</li>
          {q.invest && (
            <li>
              종목 회의 {pnlLabel(q.invest.total)} · {q.invest.title}
            </li>
          )}
          <li>수수료 {pnlLabel(q.fee)}</li>
          {q.hiring !== 0 && <li>인사 비용 {pnlLabel(-q.hiring)}</li>}
          {q.moving !== 0 && <li>이사 비용 {pnlLabel(-q.moving)}</li>}
          {q.upgrades !== 0 && <li>전투 강화 비용 {pnlLabel(-q.upgrades)}</li>}
          {q.salary !== 0 && <li>인건비 {pnlLabel(-q.salary)}</li>}
        </ul>
        {q.lines.length > 0 && (
          <ul className="mt-2 grid gap-0.5 text-[13px]" data-testid="quarter-lines">
            {q.lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 같은 소식이 두 번 올 수 있고 목록은 한 번 그리면 그대로다 (#338)
              <li key={`${i}-${line}`}>· {line}</li>
            ))}
          </ul>
        )}
        <TeamReports reports={q.reports} />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-12 w-full rounded bg-wine font-semibold text-white"
        >
          확인
        </button>
      </section>
    </Overlay>
  )
}
