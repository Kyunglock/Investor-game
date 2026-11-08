import './report-paper.css'
import './quarter-sheet.css'
import type { Company } from '../../api/client'
import { money } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { pnlLabel } from './board'
import { revealer } from './reveal'
import { TeamReports } from './TeamReports'

type Quarter = NonNullable<Company['lastQuarter']>
type Employee = Company['employees'][number]
type Flow = { key: string; label: string; note?: string; amount: number }

/** 분기 실적 줄이 차례로 드러나는 간격. 연말 결산서(160·90ms)보다 짧게 끝난다. */
const ROW_MS = 70

const tone = (amount: number) => (amount > 0 ? 'text-up' : amount < 0 ? 'text-down' : 'text-muted')

/**
 * 분기 실적 (decisions.md 268·396번, #330). 1~3분기를 넘기면 뜬다. 연말 결산서와 같은 종이에 가벼운 표지(몇 년 차 몇 분기, 네 칸 중 몇 번째)를 달고,
 * 자본이 얼마에서 얼마가 됐는지를 크게 보인 뒤 돈의 흐름·팀 실적·직원 소식을 칸을 나눠 차례로 드러낸다. 폭락이 터진 분기는 표지가 붉어지고 경고 띠가
 * 붙는다. 팀별 성적에는 팀장·팀원 등급이 붙는다(397번). 회사 등급·건물·자리 수와 직원 등급 변화는 연말에만 바뀌므로 여기에는 없다. 4분기를 넘기면 이 대신 연말 결산서가 뜬다.
 */
export function QuarterSheet({
  quarter: q,
  employees,
  onClose,
}: {
  quarter: Quarter
  employees: Employee[]
  onClose: () => void
}) {
  const change = q.capitalAfter - q.capitalBefore
  const flow = [
    { key: 'staff', label: '직원들의 운용', amount: q.staff },
    q.invest && { key: 'invest', label: '종목 회의', note: q.invest.title, amount: q.invest.total },
    { key: 'fee', label: '수수료 매출', amount: q.fee },
    q.hiring !== 0 && { key: 'hiring', label: '인사 비용', amount: -q.hiring },
    q.moving !== 0 && { key: 'moving', label: '이사 비용', amount: -q.moving },
    q.upgrades !== 0 && { key: 'upgrades', label: '전투 강화 비용', amount: -q.upgrades },
    q.rewards !== 0 && { key: 'rewards', label: '스테이지 보상', amount: q.rewards },
  ].filter((row): row is Flow => Boolean(row))
  const reveal = revealer(true, ROW_MS)
  let n = 0
  const section = (title: string) => {
    const r = reveal()
    return (
      <div className={`report-section-title ${r.className}`} style={r.style}>
        <span>{String(++n).padStart(2, '0')}</span>
        <h3>{title}</h3>
      </div>
    )
  }
  const capital = reveal()
  return (
    <Overlay>
      <section
        className={`report-paper quarter-report animate-pop ${q.crash ? 'animate-shake' : ''}`}
        data-result={change > 0 ? 'gain' : change < 0 ? 'loss' : 'flat'}
        data-crash={q.crash || undefined}
        role="dialog"
        aria-modal="true"
        aria-label="분기 실적"
        data-testid="quarter-sheet"
      >
        <header className="quarter-cover">
          <div className="quarter-cover-meta">
            <span>QUARTERLY REPORT</span>
            <ol className="quarter-pips" aria-label={`네 분기 중 ${q.quarter}번째`}>
              {[1, 2, 3, 4].map((i) => (
                <li
                  key={i}
                  data-state={i < q.quarter ? 'done' : i === q.quarter ? 'now' : 'next'}
                  aria-current={i === q.quarter ? 'step' : undefined}
                >
                  {i}
                </li>
              ))}
            </ol>
          </div>
          <h2>
            {q.year}년 차 {q.quarter}분기 실적
          </h2>
        </header>
        {q.crash && (
          <p className="quarter-crash" data-testid="quarter-crash">
            <span>⚡ 폭락이 터졌다</span>
          </p>
        )}
        <div className="report-body">
          <section
            className={`quarter-capital ${capital.className}`}
            style={capital.style}
            aria-label="분기 자본"
          >
            <p>분기 말 자본</p>
            <strong>{money(q.capitalAfter)}</strong>
            <span>분기 초 {money(q.capitalBefore)}에서</span>
            <b className={`quarter-change ${tone(change)}`} data-testid="quarter-change">
              {pnlLabel(change)}
            </b>
          </section>
          {section('이번 분기 돈의 흐름')}
          <ul className="quarter-flow">
            {flow.map((row) => {
              const r = reveal()
              return (
                <li key={row.key} className={r.className} style={r.style}>
                  <span>
                    {row.label}
                    {row.note && <small>{row.note}</small>}
                  </span>
                  <b className={tone(row.amount)}>{pnlLabel(row.amount)}</b>
                </li>
              )
            })}
          </ul>
          {q.reports.length > 0 && (
            <>
              {section('팀별 성적')}
              {(() => {
                const r = reveal()
                return (
                  <div className={`quarter-box ${r.className}`} style={r.style}>
                    <TeamReports reports={q.reports} employees={employees} />
                  </div>
                )
              })()}
            </>
          )}
          {q.lines.length > 0 && (
            <>
              {section('직원 소식')}
              <ul className="quarter-lines" data-testid="quarter-lines">
                {q.lines.map((line, i) => {
                  const r = reveal()
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: 같은 소식이 두 번 올 수 있고 목록은 한 번 그리면 그대로다 (#338)
                    <li key={`${i}-${line}`} className={r.className} style={r.style}>
                      {line}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
        <footer className="report-footer">
          <button type="button" onClick={onClose}>
            확인
          </button>
        </footer>
      </section>
    </Overlay>
  )
}
