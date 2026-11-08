import './meetings.css'
import { useEffect, useState } from 'react'
import type { Company } from '../../api/client'
import { money, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { CHART_MS, InvestChart } from './InvestChart'
import {
  chartTimeline,
  groupRemarks,
  hindsightOf,
  leadersOf,
  OPINIONS,
  percentOf,
} from './investShow'
import { useRaisingStore } from './store'
import { TeamClash, teamClashMs } from './TeamClash'
import { TeamGradeChip } from './TeamGradeChip'

type Invest = NonNullable<Company['invest']>

/** 사장 말대로 한 직원은 문장이 이미 말하므로 표를 붙이지 않는다. */
const FOLLOW: Record<string, { label: string; tone: string }> = {
  OWN: { label: '제멋대로', tone: 'bg-wine text-white' },
  SWAY: { label: '꼬드김', tone: 'bg-gold text-white' },
}

/** 이익은 빨강, 손실은 파랑 (한국 증시 색). */
function signed(amount: number): string {
  return `${amount > 0 ? '+' : ''}${money(amount)}`
}

/** 사장 결정 도장이 찍히고 막판 제안이 뜨기까지(ms) (290번). */
const DECIDED_MS = 1400

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 종목 회의 (decisions.md 229·231·235·267번). 직원이 종목을 물어 온 해에만 거시경제 회의 다음에 열린다: 창 머리에 누가 가져왔는지 보이고, 끝나면 그 사람을
 * 칭찬하거나 탓하는 한 줄이 붙는다. 한 해의 중대 결정이라 예전 매매 이벤트 창처럼 화면 가운데에 뜬다: 결산을 누르면 열리고, 고르면 결과를 보고 그대로
 * 그해 결산으로 넘어간다. 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원이 한마디씩 하고, 사장이 고른다(산다·판다·지켜본다,
 * 회의를 열면 먼저 매수파와 매도파가 불꽃을 튀기며 토론하고(352번), 그 뒤에 사장이 고른다. 전에는 "너희가 알아서 해" 하고 맡겨야 맞붙어 한쪽으로 정한다, 279번). 고르면 사장 결정에 도장이 찍히고, 돈을 굴리는 직원마다 **맞대결 막대**에서 사장 말과 꼬드김·제 판단이 엎치락뒤치락하다 이긴 쪽으로
 * 쭉 찬다(181번의 막대를 되살림). 다 끝나면 종목이 오르내린 것이 드러나고 직원마다 손익이 뜬다.
 */
export function InvestWindow({
  invest,
  year,
  quarter,
  employees,
  onClose,
  onSettle,
  hold = false,
}: {
  invest: Invest
  year: number
  quarter: number
  employees: Company['employees']
  onClose: () => void
  onSettle: () => void
  /** 결과를 아직 보이지 않는다 (348번): 디펜스 멘탈 전투가 결정 직후에 끼어들어 끝날 때까지. 풀리면 차트가 처음부터 그려진다. */
  hold?: boolean
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideInvest, answerProposal, giveVerdict } = useRaisingStore.getState()
  const outcome = invest.outcome
  const proposal = !outcome ? invest.proposal : null
  // 창을 열 때 이미 정한 회의면(다시 그림) 연출 없이 끝난 모습을 보인다. 막판 제안을 기다리는 회의도 결정 장면은 이미 본 것이다.
  const [skipped, setSkipped] = useState(
    () => Boolean(outcome) || Boolean(invest.proposal) || reducedMotion(),
  )
  // 막판 제안 (283·290번): 정해진 결정(도장, 맡겼으면 토론과 결판)을 먼저 보이고, 그 뒤에 제안을 띄운다.
  const [preplayed, setPreplayed] = useState(false)
  const decidedMs = proposal ? (proposal.delegated ? teamClashMs(proposal.debate) : DECIDED_MS) : 0
  const [proposalShown, setProposalShown] = useState(skipped)
  // 토론이 먼저 (352번): 회의를 열면 매수파·매도파가 맞붙고, 끝난 뒤에야 사장이 고른다. 다시 그린 회의(정했거나 제안 중)는 이미 본 것.
  const debate = invest.debate ?? []
  const debateFirst = !outcome && !invest.proposal && invest.convened && debate.length > 0
  const [debated, setDebated] = useState(skipped || !debateFirst)
  useEffect(() => {
    if (!debateFirst || debated) {
      return
    }
    const id = setTimeout(() => setDebated(true), teamClashMs(debate))
    return () => clearTimeout(id)
  }, [debateFirst, debated, debate])
  useEffect(() => {
    if (!proposal) {
      return
    }
    setPreplayed(true)
    if (skipped) {
      setProposalShown(true)
      return
    }
    const id = setTimeout(() => setProposalShown(true), decidedMs)
    return () => clearTimeout(id)
  }, [proposal, skipped, decidedMs])
  // 맡겼으면(279·285번) 매수파·매도파가 먼저 토론하며 맞붙고, 그 뒤에 차트가 그려진다. 막판 제안 전에 이미 봤으면 바로 차트로.
  const lead = outcome?.delegated && !preplayed ? teamClashMs(outcome.debate) : 0
  const show = chartTimeline(1, CHART_MS, skipped, lead)
  const [finished, setFinished] = useState(skipped)
  useEffect(() => {
    if (!outcome || finished || hold) {
      return
    }
    const id = setTimeout(() => setFinished(true), show.end)
    return () => clearTimeout(id)
  }, [outcome, finished, show.end, hold])
  const skip = () => {
    setSkipped(true)
    setFinished(true)
  }
  const label = (code: string) => invest.options.find((o) => o.code === code)?.label ?? code
  const loss = Boolean(outcome && outcome.total < 0)
  return (
    <Overlay>
      <section
        className={`meeting-window invest-meeting animate-pop ${
          finished && outcome && !skipped ? (loss ? 'animate-shake' : 'animate-glow') : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="종목 회의"
        data-testid="invest"
        data-finished={finished}
      >
        {/* 맡긴 회의는 토론(285번)으로 창이 길어진다: 머리줄(빨리 보기)은 내려도 위에 붙어 있다. */}
        <header className="meeting-header">
          <div>
            <p className="meeting-eyebrow">
              STOCK MEETING · {year}년 차 {quarter}분기
            </p>
            <h3>종목 회의</h3>
            <p className="meeting-subtitle">단서를 살피고, 동료의 의견을 들어보세요.</p>
          </div>
          {!outcome && (
            <button type="button" onClick={onClose} className="text-[12px] text-muted underline">
              배치 다시 보기
            </button>
          )}
          {((outcome && !finished) ||
            (proposal && !proposalShown) ||
            (debateFirst && !debated)) && (
            <button
              type="button"
              onClick={() => {
                skip()
                setProposalShown(true)
                setDebated(true)
              }}
              className="text-[12px] text-muted underline"
            >
              빨리 보기
            </button>
          )}
        </header>
        <div className="meeting-body">
          <nav className="meeting-agenda" aria-label="회의 진행">
            <span data-active={!outcome}>01 종목 분석</span>
            <span data-active={!outcome}>02 투자 결정</span>
            <span data-active={Boolean(outcome)}>03 결과 확인</span>
          </nav>
          <TeamGradeChip team={invest.team} />
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
          <article className="meeting-article mt-2 rounded border border-line bg-card p-3">
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
                // 팀장만 이름을 보이고 나머지는 "외 N명" (293번).
                const { shown, voice, others } = leadersOf(g.remarks, employees)
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
                      <ul className="flex flex-wrap items-baseline gap-1 text-ink">
                        {shown.map((r) => (
                          <li
                            key={r.employeeId}
                            className="flex items-baseline gap-1 rounded bg-card px-1.5 text-[13px]"
                          >
                            <span className="text-[11px] text-muted">팀장</span>
                            <b>{r.name}</b>
                            {/* 팀장 옆 이름 옆에 등급 (decisions.md 355번) */}
                            <span
                              className="font-mono-num text-[11px] text-muted"
                              data-testid="leader-grade"
                            >
                              {employees.find((e) => e.id === r.employeeId)?.overallGrade}
                            </span>
                          </li>
                        ))}
                        {others > 0 && <li className="text-[12px] text-muted">외 {others}명</li>}
                      </ul>
                    </div>
                    <p className="mt-1 text-[14px] text-ink" data-testid="opinion-voice">
                      “{voice.text}”{' '}
                      <span className="whitespace-nowrap text-[12px] text-muted">
                        — {voice.name}
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

          {proposal && (
            // 정해진 결정 (290번): 맡겼으면 토론과 결판, 아니면 사장 결정 도장. 그 뒤에 막판 제안이 뜬다.
            <div className="mt-3" data-testid="invest-decided">
              {proposal.delegated && (
                <TeamClash
                  key={`decided-${skipped}`}
                  buyNames={invest.remarks.filter((r) => r.read === 'UP').map((r) => r.name)}
                  sellNames={invest.remarks.filter((r) => r.read === 'DOWN').map((r) => r.name)}
                  buy={proposal.teamBuy}
                  sell={proposal.teamSell}
                  choice={proposal.choice}
                  debate={proposal.debate}
                  staff={employees}
                  stock={invest.stockName}
                  instant={skipped}
                />
              )}
              <p
                className="animate-reveal mt-2 flex items-center gap-2 text-[14px]"
                style={{
                  animationDelay: `${proposal.delegated && !skipped ? decidedMs - 600 : 0}ms`,
                }}
              >
                {proposal.delegated ? '팀 결정' : '사장 결정'}
                <span
                  className="animate-stamp pen-circle inline-block px-3 py-0.5 font-pen text-[22px] text-red-pen"
                  data-testid="decided-choice"
                >
                  {proposal.big ? `크게 ${label(proposal.choice)}` : label(proposal.choice)}
                </span>
              </p>
            </div>
          )}

          {proposal && proposalShown && invest.proposal && (
            // 막판 뒤집기 (283·292번): 결정이 다 끝났는데 누군가 "잠깐만요!" 하고 끼어든다. 회의 창 위에 알림으로 뜬다.
            <Overlay>
              <section
                className="animate-pop rounded border-4 border-gold bg-card p-5 text-center shadow-xl"
                role="alertdialog"
                aria-modal="true"
                aria-label="막판 제안"
                data-testid="invest-proposal"
              >
                <div className="animate-shake">
                  <p className="text-[40px] leading-none" aria-hidden="true">
                    ✋
                  </p>
                  <h3
                    className="mt-1 font-pen text-[34px] leading-tight text-red-pen"
                    data-testid="proposal-shout"
                  >
                    잠깐만요, 사장님!!
                  </h3>
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  결정이 끝난 줄 알았는데 {withParticle(invest.proposal.name, '이', '가')} 손을
                  들었다.
                </p>
                <p className="mt-3 text-left text-[15px]" data-testid="proposal-line">
                  {invest.proposal.line}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
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
              </section>
            </Overlay>
          )}

          {debateFirst && (
            // 토론이 먼저 (352번): 매수파·매도파가 맞붙어 한쪽으로 기운다. 사장은 보고 나서 고른다.
            <TeamClash
              key={`debate-${skipped}`}
              buyNames={invest.remarks.filter((r) => r.read === 'UP').map((r) => r.name)}
              sellNames={invest.remarks.filter((r) => r.read === 'DOWN').map((r) => r.name)}
              buy={invest.teamBuy ?? 0}
              sell={invest.teamSell ?? 0}
              choice={invest.teamCall ?? 'HOLD'}
              debate={debate}
              staff={employees}
              stock={invest.stockName}
              instant={skipped || debated}
            />
          )}
          {!outcome && !invest.proposal && (
            <div
              className="meeting-choices mt-3 grid grid-cols-3 gap-2"
              data-testid="invest-options"
            >
              {debateFirst && debated && (
                <p className="col-span-3 text-center text-[13px]" data-testid="invest-your-turn">
                  직원들은{' '}
                  <b className={invest.teamCall === 'BUY' ? 'text-up' : 'text-down'}>
                    {invest.teamCall === 'BUY' ? '사자' : '팔자'}
                  </b>{' '}
                  쪽으로 기울었다. 이제 <b>사장님 차례</b>입니다.
                </p>
              )}
              {invest.options
                .filter((o) => o.code !== 'TEAM')
                .map((o) => (
                  <button
                    key={o.code}
                    data-choice={o.code}
                    type="button"
                    disabled={busy || !invest.ready || (debateFirst && !debated)}
                    onClick={() => void decideInvest(o.code)}
                    className="min-h-12 rounded border border-pen font-semibold transition-transform hover:bg-pen hover:text-white active:scale-95 disabled:opacity-50"
                  >
                    <span className="meeting-choice-icon" aria-hidden="true">
                      {o.code === 'BUY' ? '↗' : o.code === 'SELL' ? '↘' : '◉'}
                    </span>
                    {o.label}
                  </button>
                ))}
              {debateFirst && !debated && (
                <p className="col-span-3 text-center text-[12px] text-muted">
                  토론이 끝나면 고를 수 있습니다.
                </p>
              )}
            </div>
          )}

          {outcome && !hold && (
            <div className="mt-3" data-testid="invest-outcome">
              {outcome.delegated && (
                <TeamClash
                  // 빨리 보기를 누르면 끝난 모습으로 다시 그린다. 막판 제안 전에 본 토론은 다시 돌리지 않는다.
                  key={`clash-${skipped}-${preplayed}`}
                  buyNames={invest.remarks.filter((r) => r.read === 'UP').map((r) => r.name)}
                  sellNames={invest.remarks.filter((r) => r.read === 'DOWN').map((r) => r.name)}
                  buy={outcome.teamBuy}
                  sell={outcome.teamSell}
                  choice={outcome.choice}
                  debate={outcome.debate}
                  staff={employees}
                  stock={invest.stockName}
                  instant={skipped || preplayed}
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
              {outcome.reactions && outcome.reactions.length > 0 && (
                // 결과 뒤 양쪽의 반응 (358번): 맞힌 쪽은 으스대고(혹은 "제 말 들었어야죠"), 틀린 쪽은 사과하거나 안도한다.
                <ul
                  className="mt-2 grid gap-1"
                  style={{ animationDelay: `${show.reveal}ms` }}
                  data-testid="invest-reactions"
                >
                  {outcome.reactions.map((r, i) => (
                    <li
                      key={`${r.name}-${r.side}`}
                      className={`animate-debate-in flex max-w-[92%] items-baseline gap-1.5 text-[13px] ${
                        r.side === 'BUY' ? 'self-start' : 'flex-row-reverse self-end text-right'
                      }`}
                      style={{
                        animationDelay: `${show.reveal + 300 + i * 500}ms`,
                        animationFillMode: 'both',
                      }}
                      data-side={r.side}
                      data-kind={r.kind}
                    >
                      <b className={r.kind === 'WIN' ? 'text-up' : 'text-down'}>{r.name}</b>
                      <span
                        className={`rounded-xl px-2.5 py-1 ${r.kind === 'WIN' ? 'bg-up/12' : 'bg-down/12 italic'}`}
                      >
                        {r.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
        </div>
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
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 같은 소식이 두 번 올 수 있고 목록은 한 번 그리면 그대로다 (#338)
        <li key={`${i}-${line}`}>· {line}</li>
      ))}
    </ul>
  )
}
