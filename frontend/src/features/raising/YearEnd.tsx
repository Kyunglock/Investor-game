import type { CSSProperties } from 'react'
import type { Company } from '../../api/client'
import { shortWon } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { bubbleOf, pnlLabel } from './board'
import { officeName } from './office'

type Settlement = NonNullable<Company['lastSettlement']>

export const PHASES: Record<string, string> = { boom: '호황', normal: '보통', crash: '폭락장' }

/** 결산서 줄이 차례로 드러나는 간격 (연말 결산서만). */
const STEP_MS = 700
const ROW_MS = 400

const tone = (amount: number) => (amount > 0 ? 'text-up' : amount < 0 ? 'text-down' : 'text-muted')

/**
 * 한 해의 장부 (decisions.md 240번). 투자 회의 한 건과 직원들이 1년 동안 배치대로 굴린 몫을 나눠, 연초 자본 + 회의 + 직원들 + 수수료 = 연말 자본으로 보인다.
 * 전에는 회의 창 바로 뒤에 직원별 손익이 떠서 회의 결과로 읽혔다. staged면 줄이 차례로 드러난다.
 */
export function Ledger({
  company,
  settlement: s,
  staged = false,
}: {
  company: Company
  settlement: Settlement
  staged?: boolean
}) {
  const desk = (code: string) => company.desks.find((d) => d.code === code)?.name ?? code
  const staff = s.results.reduce((sum, r) => sum + r.pnl, 0)
  let at = 0
  // 줄마다 드러나는 시각. 직원 줄은 그 사이를 짧게 잇는다.
  const reveal = (ms = STEP_MS): { className: string; style?: CSSProperties } => {
    if (!staged) {
      return { className: '' }
    }
    const style = { animationDelay: `${at}ms`, animationFillMode: 'both' as const }
    at += ms
    return { className: 'animate-reveal', style }
  }
  let n = 0
  const num = () => '①②③④'[n++]
  const before = officeName(s.gradeBefore)
  const after = officeName(s.gradeAfter)
  const rows = [
    s.invest &&
      (() => {
        const r = reveal()
        return (
          <li
            key="invest"
            className={`py-2 ${r.className}`}
            style={r.style}
            data-testid="ledger-invest"
          >
            <Row
              label={`${num()} 투자 회의`}
              note={`사장과 함께 정한 한 건 · ${s.invest.title}`}
              amount={s.invest.total}
            />
          </li>
        )
      })(),
    (() => {
      const r = reveal(ROW_MS)
      return (
        <li
          key="staff"
          className={`py-2 ${r.className}`}
          style={r.style}
          data-testid="ledger-staff"
        >
          <Row
            label={`${num()} 직원들의 1년 운용`}
            note="회의 밖에서 1년 내내 배치대로 알아서 굴린 몫"
            amount={staff}
          />
          {s.results.length === 0 ? (
            <p className="mt-1 text-[12px] text-muted">돈을 굴린 직원이 없었다.</p>
          ) : (
            <ol
              className="mt-1.5 rounded bg-ink p-2 font-mono-num text-[13px] text-white"
              aria-label="결산 전광판"
              data-testid="board"
            >
              {s.results.map((x) => {
                const row = reveal(ROW_MS)
                const bubble = bubbleOf(x.flips, x.pnl)
                return (
                  <li
                    key={x.employeeId}
                    className={`flex flex-wrap items-baseline justify-between gap-x-2 py-0.5 ${row.className}`}
                    style={row.style}
                  >
                    <span>
                      {x.name} · {desk(x.desk)}
                    </span>
                    <b className={x.pnl >= 0 ? 'text-[#ff8a7a]' : 'text-[#8cc3ec]'}>
                      {pnlLabel(x.pnl)}
                    </b>
                    {bubble && (
                      <span
                        className="w-full rounded bg-white px-2 text-[12px] text-ink"
                        data-testid="bubble"
                      >
                        💬 {bubble}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </li>
      )
    })(),
    (() => {
      const r = reveal()
      return (
        <li key="fee" className={`py-2 ${r.className}`} style={r.style}>
          <Row
            label={`${num()} 수수료 매출`}
            note="객장 손님이 맡긴 돈에서 들어온 몫"
            amount={s.fee}
          />
        </li>
      )
    })(),
    // 그해 공채에 쓴 돈 (decisions.md 250번): 연초 자본에서 계약금이 소리 없이 빠져 보이지 않게.
    s.hiring > 0 &&
      (() => {
        const r = reveal()
        return (
          <li
            key="hiring"
            className={`py-2 ${r.className}`}
            style={r.style}
            data-testid="ledger-hiring"
          >
            <Row
              label={`${num()} 채용비`}
              note="공채 계약금과 지원자 새로 받기 값"
              amount={-s.hiring}
            />
          </li>
        )
      })(),
  ]
  const end = reveal()
  return (
    <div data-testid="ledger">
      <p className="flex items-baseline justify-between text-[14px]">
        <span className="text-muted">연초 자본</span>
        <span className="font-mono-num">{shortWon(s.capitalBefore)}</span>
      </p>
      <ol className="mt-1 divide-y divide-line-soft border-y border-line">{rows}</ol>
      <div className={`pt-2 ${end.className}`} style={end.style}>
        <p className="flex items-baseline justify-between text-[15px]">
          <b>연말 자본</b>
          <b className="font-mono-num text-[18px]" data-testid="ledger-after">
            {shortWon(s.capitalAfter)}
          </b>
        </p>
        {before !== after ? (
          <p className="text-right text-[13px] font-semibold text-gold">
            이사 {before} → {after}
          </p>
        ) : (
          s.gradeBefore !== s.gradeAfter && (
            <p className="text-right text-[13px] text-gold">
              {s.capitalAfter > s.capitalBefore ? '사무실을 넓혔다' : '사무실을 줄였다'}
            </p>
          )
        )}
      </div>
    </div>
  )
}

function Row({ label, note, amount }: { label: string; note: string; amount: number }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{label}</p>
        <p className="text-[12px] text-muted">{note}</p>
      </div>
      <b className={`shrink-0 font-mono-num text-[15px] ${tone(amount)}`}>{pnlLabel(amount)}</b>
    </div>
  )
}

/**
 * 연말 결산서 (240번). 결산하면 회의 창이 닫히고 따로 뜬다: "투자 회의는 한 건, 나머지 1년은 직원들이"를 먼저 말하고 장부가 한 줄씩 드러난다. 확인하면 닫히고
 * 지난 결산 탭에 같은 장부가 남는다.
 */
export function YearEndSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const s = company.lastSettlement
  if (!s) {
    return null
  }
  // 확인 버튼은 장부의 마지막 줄(연말 자본)과 함께 나온다.
  const done =
    (s.invest ? STEP_MS : 0) +
    (s.hiring > 0 ? STEP_MS : 0) +
    ROW_MS * (1 + s.results.length) +
    STEP_MS * 2
  return (
    <Overlay>
      <section
        className="animate-pop rounded bg-card p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="연말 결산서"
        data-testid="year-end"
      >
        <h2 className="font-pen text-[26px] leading-tight">
          {s.year}년 차 연말 결산서{' '}
          <span className="text-[18px] text-muted">· {PHASES[s.phase]}</span>
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          투자 회의는 한 해의 일 가운데 <b className="text-ink">한 건</b>입니다. 나머지 1년 동안
          직원들은 배치대로 알아서 굴렸습니다.
        </p>
        <div className="mt-3">
          <Ledger company={company} settlement={s} staged />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="animate-reveal mt-4 min-h-12 w-full rounded bg-wine font-semibold text-white"
          style={{ animationDelay: `${done}ms`, animationFillMode: 'both' }}
        >
          확인
        </button>
      </section>
    </Overlay>
  )
}
