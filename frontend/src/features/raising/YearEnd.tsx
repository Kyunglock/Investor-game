import type { CSSProperties } from 'react'
import type { Company } from '../../api/client'
import { money } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { bubbleOf, pnlLabel, teamRows } from './board'
import { officeName } from './office'
import { TeamReports } from './TeamReports'

type Settlement = NonNullable<Company['lastSettlement']>

export const PHASES: Record<string, string> = { boom: '호황', normal: '보통', crash: '폭락장' }

/** 거시경제 회의의 태도 이름 (decisions.md 266번). */
export const STANCES: Record<string, string> = {
  AGGRESSIVE: '공격',
  NEUTRAL: '중립',
  DEFENSIVE: '방어',
}

/** 결산서 줄이 차례로 드러나는 간격 (연말 결산서만). */
const STEP_MS = 700
const ROW_MS = 400

const tone = (amount: number) => (amount > 0 ? 'text-up' : amount < 0 ? 'text-down' : 'text-muted')

/**
 * 한 해의 장부 (decisions.md 240번). 투자 회의 한 건과 직원들이 1년 동안 배치대로 굴린 몫을 나눠, 연초 자본 + 회의 + 직원들 + 수수료 = 연말 자본으로 보인다.
 * 전에는 회의 창 바로 뒤에 직원별 손익이 떠서 회의 결과로 읽혔다. 직원들의 몫은 자리마다 한 줄로 묶고 이름은 팀장만 적는다 (292번). staged면 줄이 차례로
 * 드러난다.
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
  // 전광판은 자리마다 한 줄, 이름은 팀장만 (292번).
  const teams = teamRows(s.results, s.reports)
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
  const num = () => '①②③④⑤'[n++]
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
              label={`${num()} 종목 회의`}
              note={`직원이 물어 온 종목 · ${s.invest.title}`}
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
              {teams.map((x) => {
                const row = reveal(ROW_MS)
                // 팀장과 해로 문구를 돌린다 (255번).
                const bubble = bubbleOf(x.flips, x.pnl, x.stake, x.leaderId * 7 + s.year)
                return (
                  <li
                    key={x.desk}
                    className={`flex flex-wrap items-baseline justify-between gap-x-2 py-0.5 ${row.className}`}
                    style={row.style}
                    data-testid="board-team"
                  >
                    <span>
                      {desk(x.desk)} · 팀장 {x.leader}
                      {x.members > 1 && (
                        <span className="ml-1 text-[11px] opacity-70">외 {x.members - 1}명</span>
                      )}
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
    // 연봉 (decisions.md 270번): 상가부터 직원들에게 나간다.
    s.salary !== 0 &&
      (() => {
        const r = reveal()
        return (
          <li
            key="salary"
            className={`py-2 ${r.className}`}
            style={r.style}
            data-testid="ledger-salary"
          >
            <Row
              label={`${num()} 인건비`}
              note="직원들의 연봉, 분기마다 나갔다"
              amount={-s.salary}
            />
          </li>
        )
      })(),
    // 이사 비용 (decisions.md 296번): 건물을 올리는 데 낸 돈.
    s.moving !== 0 &&
      (() => {
        const r = reveal()
        return (
          <li
            key="moving"
            className={`py-2 ${r.className}`}
            style={r.style}
            data-testid="ledger-moving"
          >
            <Row
              label={`${num()} 이사 비용`}
              note="건물을 올리는 데 낸 돈 · 번 돈의 보람"
              amount={-s.moving}
            />
          </li>
        )
      })(),
    // 그해 인사에 쓴 돈 (decisions.md 251번): 붙잡는 값·성과금, 받은 이적료는 뺀다. 채용 뽑기는 돈이 들지 않는다(312번).
    s.hiring !== 0 &&
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
              label={`${num()} 인사 비용`}
              note="붙잡는 값·성과금, 받은 이적료는 뺀다"
              amount={-s.hiring}
            />
          </li>
        )
      })(),
  ]
  const end = reveal()
  return (
    <div data-testid="ledger">
      {s.quarters.length > 0 && <QuarterBars quarters={s.quarters} />}
      <p className="flex items-baseline justify-between text-[14px]">
        <span className="text-muted">연초 자본</span>
        <span className="font-mono-num">{money(s.capitalBefore)}</span>
      </p>
      <ol className="mt-1 divide-y divide-line-soft border-y border-line">{rows}</ol>
      <div className={`pt-2 ${end.className}`} style={end.style}>
        <p className="flex items-baseline justify-between text-[15px]">
          <b>연말 자본</b>
          <b className="font-mono-num text-[18px]" data-testid="ledger-after">
            {money(s.capitalAfter)}
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

/**
 * 분기별 막대 (decisions.md 268번): 분기마다 자본이 얼마나 움직였는지와 그 분기 태도. "2분기에 크게 잃고 4분기에 되찾았다"가 한눈에 보인다. 폭락이 터진
 * 분기에는 번개 표시.
 */
function QuarterBars({ quarters }: { quarters: Settlement['quarters'] }) {
  const moves = quarters.map((q) => q.capitalAfter - q.capitalBefore)
  const most = Math.max(1, ...moves.map((m) => Math.abs(m)))
  return (
    <ol
      className="mb-2 grid grid-cols-4 gap-1 rounded border border-line-soft p-2"
      aria-label="분기별 실적"
      data-testid="quarter-bars"
    >
      {quarters.map((q, i) => {
        const m = moves[i]
        const height = Math.max(4, Math.round((Math.abs(m) / most) * 40))
        return (
          <li key={q.quarter} className="flex flex-col items-center text-center">
            <div className="flex h-[84px] w-full flex-col justify-center">
              <div className="flex h-10 items-end justify-center">
                {m >= 0 && <span className="w-5 rounded-t bg-up" style={{ height }} />}
              </div>
              <div className="h-px w-full bg-line" />
              <div className="flex h-10 items-start justify-center">
                {m < 0 && <span className="w-5 rounded-b bg-down" style={{ height }} />}
              </div>
            </div>
            <p className="text-[12px] font-semibold">
              {q.crash && '⚡'}
              {q.quarter}분기
            </p>
            <p className={`font-mono-num text-[11px] ${tone(m)}`}>{pnlLabel(m)}</p>
            {q.stance && <p className="text-[11px] text-muted">{STANCES[q.stance]}</p>}
          </li>
        )
      })}
    </ol>
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
    (s.hiring !== 0 ? STEP_MS : 0) +
    (s.moving !== 0 ? STEP_MS : 0) +
    (s.salary !== 0 ? STEP_MS : 0) +
    ROW_MS * (1 + teamRows(s.results, s.reports).length) +
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
          네 분기 동안 거시경제 회의에서 정한 태도로 직원들이 배치대로 알아서 굴렸습니다. 종목
          회의는 직원이 물어 온 건만 따로 셉니다.
        </p>
        <div className="mt-3">
          <Ledger company={company} settlement={s} staged />
        </div>
        <div
          className="animate-reveal"
          style={{ animationDelay: `${done}ms`, animationFillMode: 'both' }}
        >
          <TeamReports reports={s.reports} />
        </div>
        {s.achieved.length > 0 && (
          // 그해 연 업적 (263번).
          <p
            className="animate-stamp mt-3 rounded border border-gold px-3 py-2 text-center text-[14px] font-semibold text-gold"
            style={{ animationDelay: `${done}ms`, animationFillMode: 'both' }}
            data-testid="achieved"
          >
            🏆 업적: {s.achieved.join(' · ')}
          </p>
        )}
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
