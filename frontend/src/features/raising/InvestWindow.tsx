import { useEffect, useState } from 'react'
import type { Company } from '../../api/client'
import { shortWon, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { CHART_MS, InvestChart } from './InvestChart'
import {
  chartTimeline,
  groupRemarks,
  hindsightOf,
  OPINIONS,
  percentOf,
  spokesperson,
} from './investShow'
import { useRaisingStore } from './store'
import { TeamClash, teamClashMs } from './TeamClash'

type Invest = NonNullable<Company['invest']>

/** 사장 말대로 한 직원은 문장이 이미 말하므로 표를 붙이지 않는다. */
const FOLLOW: Record<string, { label: string; tone: string }> = {
  OWN: { label: '제멋대로', tone: 'bg-wine text-white' },
  SWAY: { label: '꼬드김', tone: 'bg-gold text-white' },
}

/** 이익은 빨강, 손실은 파랑 (한국 증시 색). */
function signed(amount: number): string {
  return `${amount > 0 ? '+' : ''}${shortWon(amount)}`
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 종목 회의 (decisions.md 229·231·235·267번). 직원이 종목을 물어 온 해에만 거시경제 회의 다음에 열린다: 창 머리에 누가 가져왔는지 보이고, 끝나면 그 사람을
 * 칭찬하거나 탓하는 한 줄이 붙는다. 한 해의 중대 결정이라 예전 매매 이벤트 창처럼 화면 가운데에 뜬다: 결산을 누르면 열리고, 고르면 결과를 보고 그대로
 * 그해 결산으로 넘어간다. 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원이 한마디씩 하고, 사장이 고른다(산다·판다·지켜본다,
 * 또는 "너희가 알아서 해" 하고 맡기면 매수파와 매도파가 불꽃을 튀기며 맞붙어 한쪽으로 정한다, 279번). 고르면 사장 결정에 도장이 찍히고, 돈을 굴리는 직원마다 **맞대결 막대**에서 사장 말과 꼬드김·제 판단이 엎치락뒤치락하다 이긴 쪽으로
 * 쭉 찬다(181번의 막대를 되살림). 다 끝나면 종목이 오르내린 것이 드러나고 직원마다 손익이 뜬다.
 */
export function InvestWindow({
  invest,
  year,
  quarter,
  employees,
  onClose,
  onSettle,
}: {
  invest: Invest
  year: number
  quarter: number
  employees: Company['employees']
  onClose: () => void
  onSettle: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideInvest, answerProposal, giveVerdict } = useRaisingStore.getState()
  const outcome = invest.outcome
  // 창을 열 때 이미 정한 회의면(다시 그림) 연출 없이 끝난 모습을 보인다.
  const [skipped, setSkipped] = useState(() => Boolean(outcome) || reducedMotion())
  // 맡겼으면(279·285번) 매수파·매도파가 먼저 토론하며 맞붙고, 그 뒤에 차트가 그려진다.
  const lead = outcome?.delegated ? teamClashMs(outcome.debate) : 0
  const show = chartTimeline(1, CHART_MS, skipped, lead)
  const [finished, setFinished] = useState(skipped)
  useEffect(() => {
    if (!outcome || finished) {
      return
    }
    const id = setTimeout(() => setFinished(true), show.end)
    return () => clearTimeout(id)
  }, [outcome, finished, show.end])
  const skip = () => {
    setSkipped(true)
    setFinished(true)
  }
  const label = (code: string) => invest.options.find((o) => o.code === code)?.label ?? code
  const loss = Boolean(outcome && outcome.total < 0)
  return (
    <Overlay>
      <section
        className={`animate-pop rounded bg-card p-5 shadow-xl ${
          finished && outcome && !skipped ? (loss ? 'animate-shake' : 'animate-glow') : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="종목 회의"
        data-testid="invest"
        data-finished={finished}
      >
        {/* 맡긴 회의는 토론(285번)으로 창이 길어진다: 머리줄(빨리 보기)은 내려도 위에 붙어 있다. */}
        <header className="sticky top-0 z-20 -mx-5 -mt-5 flex items-baseline justify-between rounded-t bg-card px-5 pt-5 pb-1">
          <h3 className="font-pen text-[24px]">
            {year}년 차 {quarter}분기 종목 회의
          </h3>
          {!outcome && (
            <button type="button" onClick={onClose} className="text-[12px] text-muted underline">
              배치 다시 보기
            </button>
          )}
          {outcome && !finished && (
            <button type="button" onClick={skip} className="text-[12px] text-muted underline">
              빨리 보기
            </button>
          )}
        </header>
        {invest.finder && (
          <p className="mt-1 text-[13px]" data-testid="invest-finder">
            <b>
              {withParticle(
                invest.finder.role
                  ? `${invest.finder.name} ${invest.finder.role}`
                  : invest.finder.name,
                '이',
                '가',
              )}
            </b>{' '}
            가져온 종목 · <span className="text-muted">“{invest.finder.pitch}”</span>
          </p>
        )}
        <article className="mt-2 rounded border border-line bg-card p-3">
          <p className="text-[12px] text-muted">
            {invest.sectorName} · {invest.stockName}
          </p>
          <h4 className="mt-0.5 font-semibold text-[16px]">{invest.title}</h4>
          <p className="mt-2 text-[14px] leading-relaxed" data-testid="invest-article">
            {invest.sentences.map((s, i) => (
              <span
                // 문장 순서는 회의 내내 그대로다.
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 문장이 두 번 나오지 않지만 순서가 곧 정체다
                key={i}
                className={`${s.highlighted ? 'highlighter' : ''} ${
                  outcome && outcome.decisive === i ? 'decisive' : ''
                }`}
                style={
                  outcome && outcome.decisive === i
                    ? { animationDelay: `${show.reveal}ms` }
                    : undefined
                }
                data-highlighted={s.highlighted}
              >
                {s.text}{' '}
              </span>
            ))}
          </p>
          {invest.highlightBy && (
            <p className="mt-1 text-[12px] text-muted">형광펜: 리서치 팀 {invest.highlightBy}</p>
          )}
          <p className="mt-2 rounded border border-line-soft px-2 py-1 text-[13px]">
            <b>{invest.sway.who}</b>: “{invest.sway.text}”
          </p>
        </article>

        {invest.remarks.length > 0 && !outcome && (
          // 같은 의견끼리 뭉친다 (242·246번): 의견마다 칸 하나, 그 의견을 낸 사람들의 이름(고집 표시)을 한 줄로 묶고, 한마디는 그 칸에서
          // 안목이 가장 높은 사람이 대표로 한 번만 한다. 사람이 많은 의견이 먼저.
          <div className="mt-2 grid gap-2" data-testid="remarks">
            {groupRemarks(invest.remarks).map((g, i) => {
              const voice = spokesperson(g.remarks, employees)
              const others = g.remarks.length - 1
              return (
                <section
                  key={g.read}
                  className={`animate-reveal rounded border-l-4 bg-line-soft/40 py-1.5 pr-2 pl-2.5 ${OPINIONS[g.read].tone}`}
                  // 의견 칸이 차례로 나온다.
                  style={{ animationDelay: `${250 + i * 300}ms` }}
                  aria-label={`${OPINIONS[g.read].label} ${g.remarks.length}명`}
                  data-testid="opinion"
                  data-read={g.read}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="font-bold text-[14px]">
                      {OPINIONS[g.read].label}{' '}
                      <span className="font-mono-num text-[13px]">· {g.remarks.length}명</span>
                    </h4>
                    <ul className="flex flex-wrap gap-1 text-ink">
                      {g.remarks.map((r) => (
                        <li
                          key={r.employeeId}
                          className="flex items-baseline gap-1 rounded bg-card px-1.5 text-[13px]"
                        >
                          <b>{r.name}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-1 text-[14px] text-ink" data-testid="opinion-voice">
                    “{voice.text}”{' '}
                    <span className="whitespace-nowrap text-[12px] text-muted">
                      — {voice.name}
                      {others > 0 && ` 외 ${others}명`}
                    </span>
                  </p>
                </section>
              )
            })}
          </div>
        )}

        {!outcome && (
          <p className="mt-2 text-[12px] text-muted" data-testid="invest-frozen">
            회의에서 나온 말은 배치를 다시 바꿔도 그대로입니다.
          </p>
        )}

        {!outcome && invest.proposal && (
          // 막판 뒤집기 (283번): 결정이 다 끝났는데 누군가 반대로 하자고 나섰다.
          <div
            className="animate-pop mt-3 rounded border-2 border-gold bg-card p-3"
            data-testid="invest-proposal"
          >
            <p className="text-[12px] font-semibold text-gold">잠깐! 막판 제안</p>
            <p className="mt-1 text-[15px]" data-testid="proposal-line">
              {invest.proposal.line}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void answerProposal(true)}
                className="min-h-12 rounded bg-gold font-semibold text-white disabled:opacity-50"
              >
                그래, 네 말대로 해 · {label(invest.proposal.action)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void answerProposal(false)}
                className="min-h-12 rounded border border-pen font-semibold disabled:opacity-50"
              >
                됐어, 원래대로 해
              </button>
            </div>
          </div>
        )}

        {!outcome && !invest.proposal && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {invest.options
              .filter((o) => o.code !== 'TEAM')
              .map((o) => (
                <button
                  key={o.code}
                  type="button"
                  disabled={busy || !invest.ready}
                  onClick={() => void decideInvest(o.code)}
                  className="min-h-12 rounded border border-pen font-semibold transition-transform hover:bg-pen hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {o.label}
                </button>
              ))}
            {/* 너희가 알아서 해 (279번): 직원들끼리 맞붙어 사거나 판다. */}
            {invest.options
              .filter((o) => o.code === 'TEAM')
              .map((o) => (
                <button
                  key={o.code}
                  type="button"
                  disabled={busy || !invest.ready}
                  onClick={() => void decideInvest(o.code)}
                  className="col-span-3 min-h-12 rounded border border-wine font-semibold text-wine transition-transform hover:bg-wine hover:text-white active:scale-95 disabled:opacity-50"
                  data-testid="invest-team"
                >
                  “{o.label}”
                </button>
              ))}
            <p className="col-span-3 text-center text-[12px] text-muted">
              맡기면 직원들끼리 의견을 맞붙여 사거나 팝니다. 안목이 높은 사람 말이 더 무겁습니다.
            </p>
          </div>
        )}

        {outcome && (
          <div className="mt-3" data-testid="invest-outcome">
            {outcome.delegated && (
              <TeamClash
                // 빨리 보기를 누르면 끝난 모습으로 다시 그린다.
                key={`clash-${skipped}`}
                buyNames={invest.remarks.filter((r) => r.read === 'UP').map((r) => r.name)}
                sellNames={invest.remarks.filter((r) => r.read === 'DOWN').map((r) => r.name)}
                buy={outcome.teamBuy}
                sell={outcome.teamSell}
                choice={outcome.choice}
                debate={outcome.debate}
                staff={employees}
                instant={skipped}
              />
            )}
            <p
              className="animate-reveal mt-2 flex items-center gap-2 text-[14px]"
              style={{ animationDelay: `${lead}ms` }}
            >
              {outcome.delegated ? '팀 결정' : '사장 결정'}
              <span
                className="animate-stamp pen-circle inline-block px-3 py-0.5 font-pen text-[22px] text-red-pen"
                style={{ animationDelay: `${lead}ms` }}
                data-testid="invest-choice"
              >
                {outcome.big ? `크게 ${label(outcome.choice)}` : label(outcome.choice)}
              </span>
            </p>
            {/* 결정 장면 (283번): 직원마다 막대 대신 종목 차트가 그려지며 오르거나 빠진다. */}
            <InvestChart
              // 빨리 보기를 누르면 다 그린 차트로 다시 그린다.
              key={`chart-${skipped}`}
              stock={invest.stockName}
              up={outcome.up}
              percent={percentOf(outcome.reveal)}
              delay={show.chartAt}
              instant={skipped}
            />
            {/* 직원마다 한 줄씩 돌던 결과는 뺐다 (decisions.md 284번): 회의 손익 하나만 본다. 사장 말을 안 따른 사람만 한 줄로 알린다. */}
            {outcome.results.some((r) => r.follow !== 'BOSS') && (
              <p
                className="animate-reveal mt-2 rounded bg-line-soft/60 px-2 py-1 text-[13px]"
                style={{ animationDelay: `${show.pnlAt(0)}ms` }}
                data-testid="invest-strays"
              >
                {outcome.results
                  .filter((r) => r.follow !== 'BOSS')
                  .map((r) => (
                    <span key={r.employeeId} className="mr-2 inline-block">
                      <span className={`mr-1 rounded px-1 text-[11px] ${FOLLOW[r.follow].tone}`}>
                        {FOLLOW[r.follow].label}
                      </span>
                      <b>{r.name}</b> {r.line}
                    </span>
                  ))}
              </p>
            )}
            <p
              className="animate-stamp mt-3 text-center font-semibold text-[16px]"
              style={{ animationDelay: `${show.reveal}ms` }}
              data-testid="invest-reveal"
            >
              <span className={outcome.up ? 'text-up' : 'text-down'}>
                {outcome.up ? '▲' : '▼'} {outcome.reveal}
              </span>
            </p>
            <p
              className="animate-reveal mt-1 text-center text-[15px]"
              style={{ animationDelay: `${show.total}ms` }}
            >
              회의 손익{' '}
              <b
                className={`animate-flash text-[20px] ${outcome.total >= 0 ? 'text-up' : 'text-down'}`}
                style={{ animationDelay: `${show.total}ms` }}
              >
                {signed(outcome.total)}
              </b>
            </p>
            {finished && (
              <>
                {outcome.credit && (
                  <p
                    className="animate-reveal mt-2 text-center text-[14px] font-semibold"
                    data-testid="invest-credit"
                  >
                    {outcome.credit}
                  </p>
                )}
                <Hindsight invest={invest} />
                {invest.verdict && (
                  // 막판 제안을 따랐다 (283번): 결과를 보고 상이나 벌을 준다.
                  <div
                    className="animate-pop mt-3 rounded border-2 border-gold p-3"
                    data-testid="invest-verdict"
                  >
                    <p className="text-[15px] font-semibold">{invest.verdict.ask}</p>
                    {invest.verdict.options.length > 0 ? (
                      <div className="mt-2 grid gap-2">
                        {invest.verdict.options.map((o) => (
                          <button
                            key={o.code}
                            type="button"
                            disabled={busy}
                            onClick={() => void giveVerdict(o.code)}
                            className={`min-h-11 rounded border text-[14px] font-semibold disabled:opacity-50 ${
                              invest.verdict?.good ? 'border-up text-up' : 'border-down text-down'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[14px]" data-testid="verdict-result">
                        {invest.verdict.result}
                      </p>
                    )}
                  </div>
                )}
                <p
                  className="animate-reveal mt-3 rounded bg-line-soft px-3 py-2 text-center text-[13px]"
                  data-testid="invest-next"
                >
                  회의는 이 <b>한 건</b>으로 끝났습니다. 이제 직원들이 <b>이번 분기</b>에 배치대로
                  굴린 결과를 봅니다.
                </p>
                <button
                  type="button"
                  // 상이나 벌을 고르기 전에는 넘기지 않는다 (283번).
                  disabled={busy || (invest.verdict?.options.length ?? 0) > 0}
                  onClick={onSettle}
                  className="animate-reveal mt-2 min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
                >
                  {year}년 차 {quarter}분기 넘기기 →
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </Overlay>
  )
}

/**
 * 회의 뒤 돌아보기 (decisions.md 260번): 지켜봤으면 놓친 돈, 직원 다수결과 형광펜이 맞았는지. 사장 실력이 숫자로 보인다.
 */
function Hindsight({ invest }: { invest: Invest }) {
  const outcome = invest.outcome
  if (!outcome) {
    return null
  }
  const lines = hindsightOf(invest)
  return (
    <ul className="animate-reveal mt-3 grid gap-0.5 text-[13px]" data-testid="hindsight">
      {lines.map((line) => (
        <li key={line}>· {line}</li>
      ))}
    </ul>
  )
}
