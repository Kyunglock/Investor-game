import { BattleEntryButton } from './BattleEntryButton'
import './meetings.css'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Company } from '../../api/client'
import { money } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { CHART_MS, InvestChart } from './InvestChart'
import { ReturnResult } from './InvestReturn'
import { chartTimeline, groupRemarks, leadersOf, OPINIONS, percentOf } from './investShow'
import { useRaisingStore } from './store'
import { TeamClash, teamClashMs } from './TeamClash'

type Invest = NonNullable<Company['invest']>

/** 종목 회의의 세 단계 (decisions.md 368번). */
type Step = 'analysis' | 'decide' | 'result'

/** 사장 말대로 한 직원은 문장이 이미 말하므로 표를 붙이지 않는다. */
const FOLLOW: Record<string, { label: string; tone: string }> = {
  OWN: { label: '제멋대로', tone: 'bg-wine text-white' },
  SWAY: { label: '꼬드김', tone: 'bg-gold text-white' },
}

/** 이익은 빨강, 손실은 파랑 (한국 증시 색). */
function signed(amount: number): string {
  return `${amount > 0 ? '+' : ''}${money(amount)}`
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 종목 회의 (decisions.md 229·231·235·267번). 분기 넘기기를 눌러 직원이 종목을 물어 왔을 때만 열린다(382번): 창 머리에 누가 가져왔는지 보이고, 끝나면 그 사람을
 * 칭찬하거나 탓하는 한 줄이 붙는다. 한 해의 중대 결정이라 예전 매매 이벤트 창처럼 화면 가운데에 뜬다: 결산을 누르면 열리고, 고르면 결과를 보고 그대로
 * 그해 결산으로 넘어간다. 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원이 한마디씩 하고, 사장이 고른다(산다·판다, 지켜본다는 423번에서 뺐다,
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
  onBattle,
  battleInOffice = false,
  hold = false,
}: {
  invest: Invest
  year: number
  quarter: number
  employees: Company['employees']
  onClose: () => void
  onSettle: () => void
  /**
   * 회의 뒤 전투로 간다 (decisions.md 414번, #573): 틀렸으면 디펜스로 손실을 줄이고, 맞혔으면 공격 판(매도벽)으로 수익을 키운다. 주지 않으면(웹) 전투
   * 없이 그대로다.
   */
  onBattle?: (battle: NonNullable<NonNullable<Invest['outcome']>['battle']>) => void
  /** 앱에서는 회의 결과에서 시작하지 않고 사무실의 버튼으로만 전투에 들어간다. */
  battleInOffice?: boolean
  /** 결과를 아직 보이지 않는다 (348번): 디펜스 멘탈 전투가 결정 직후에 끼어들어 끝날 때까지. 풀리면 차트가 처음부터 그려진다. */
  hold?: boolean
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideInvest } = useRaisingStore.getState()
  const outcome = invest.outcome
  const hasBattle = Boolean(onBattle) || battleInOffice
  // 세 단계를 한 화면씩 (decisions.md 368번): 종목 분석 → (결정하러 가기) → 투자 결정 → 결과 확인. 정했으면 결과 화면이다.
  const [stage, setStage] = useState<'analysis' | 'decide'>(() =>
    invest.outcome ? 'decide' : 'analysis',
  )
  const step: Step = outcome ? 'result' : stage
  const scroller = useRef<HTMLElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 단계가 바뀔 때마다 새 화면의 맨 위부터 본다.
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: 0 })
  }, [step])
  // 창을 열 때 이미 정한 회의면(다시 그림) 연출 없이 끝난 모습을 보인다.
  const [skipped, setSkipped] = useState(() => Boolean(outcome) || reducedMotion())
  // 토론은 접어 둔다 (decisions.md 370번, #498): 결과 한 줄만 보이고, 펼쳐야 토론이 나온다. 접혀 있으면 토론을 기다리지 않는다.
  const [debateOpen, setDebateOpen] = useState(false)
  // 토론이 먼저 (352번): 회의를 열면 매수파·매도파가 맞붙고, 끝난 뒤에야 사장이 고른다. 다시 그린 회의(정했으면)는 이미 본 것.
  const debate = invest.debate ?? []
  const debateFirst = !outcome && invest.convened && debate.length > 0
  const [debated, setDebated] = useState(skipped || !debateFirst)
  // 펼쳐 둔 토론이 끝나기를 기다리는 중: 이때만 고르기를 잠근다.
  const waiting = debateFirst && debateOpen && !debated
  useEffect(() => {
    // 토론은 결정 화면에서 펼쳐야 시작한다: 분석을 읽는 동안 저절로 끝나 버리지 않게.
    if (!debateFirst || debated || !debateOpen || step !== 'decide') {
      return
    }
    const id = setTimeout(() => setDebated(true), teamClashMs(debate))
    return () => clearTimeout(id)
  }, [debateFirst, debated, debateOpen, debate, step])
  // 맡겼으면(279·285번) 매수파·매도파가 먼저 토론하며 맞붙고, 그 뒤에 차트가 그려진다.
  const lead = outcome?.delegated && debateOpen ? teamClashMs(outcome.debate) : 0
  const show = chartTimeline(1, CHART_MS, skipped, lead)
  const [finished, setFinished] = useState(skipped)
  useEffect(() => {
    if (!outcome || finished || hold) {
      return
    }
    const id = setTimeout(() => setFinished(true), show.end)
    return () => clearTimeout(id)
  }, [outcome, finished, show.end, hold])
  // 빨리 보기 (395번): 결과면 차트를 다 그린 모습으로, 토론 중이면 다 오간 모습으로 넘긴다.
  const skip = () => {
    setSkipped(true)
    setFinished(true)
    setDebated(true)
  }
  const label = (code: string) => invest.options.find((o) => o.code === code)?.label ?? code
  const loss = Boolean(outcome && outcome.total < 0)
  // 회의 뒤 전투를 마치고 돌아왔으면 (#591, decisions.md 428번) 회의 결과 전체 대신 전투 결과 한 장과 분기 넘기기만 보인다.
  const battleDone = Boolean(
    hasBattle && outcome?.battle && outcome.battle.stars != null && outcome.battle.after != null,
  )
  return (
    <Overlay>
      <section
        ref={scroller}
        className={`meeting-window invest-meeting animate-pop ${
          finished && outcome && !skipped ? (loss ? 'animate-shake' : 'animate-glow') : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="종목 회의"
        data-testid="invest"
        data-finished={finished}
      >
        {/* 머리줄은 내려도 위에 붙어 있다. 빨리 보기는 여기 두지 않고 차트(토론) 바로 밑에 둔다 (decisions.md 395번). */}
        <header className="meeting-header">
          <div>
            <p className="meeting-eyebrow">
              STOCK MEETING · {year}년 차 {quarter}분기
            </p>
            <h3>종목 회의</h3>
            <p className="meeting-subtitle">단서를 살피고, 동료의 의견을 들어보세요.</p>
          </div>
          {outcome && hasBattle && (
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="meeting-exit"
              data-testid="invest-leave"
            >
              사무실로 나가기
            </button>
          )}
          {!outcome && (
            <button type="button" onClick={onClose} className="text-[12px] text-muted underline">
              배치 다시 보기
            </button>
          )}
        </header>
        <div className="meeting-body" data-step={step}>
          {step === 'analysis' && (
            <>
              {/* 팀 합산 칩과 "○○이 가져온 종목" 줄은 뺐다 (decisions.md 422번, #588). */}
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
                  <p className="mt-1 text-[12px] text-muted">
                    형광펜: 리서치 팀 {invest.highlightBy}
                  </p>
                )}
                <p className="mt-2 rounded border border-line-soft px-2 py-1 text-[13px]">
                  <b>{invest.sway.who}</b>: “{invest.sway.text}”
                </p>
              </article>

              {!outcome && (
                <p className="mt-2 text-[12px] text-muted" data-testid="invest-frozen">
                  회의에서 나온 말은 배치를 다시 바꿔도 그대로입니다.
                </p>
              )}
              {/* 단계마다 누를 버튼은 창 아래에 붙어 있다 (368번): 내용이 길어도 버튼은 늘 보인다. */}
              <div className="meeting-step-action">
                <button
                  type="button"
                  onClick={() => setStage('decide')}
                  className="min-h-12 w-full rounded bg-wine font-semibold text-white"
                  data-testid="invest-to-decide"
                >
                  결정하러 가기 →
                </button>
              </div>
            </>
          )}

          {step === 'decide' && (
            <>
              <button
                type="button"
                onClick={() => setStage('analysis')}
                className="mt-1 text-[12px] text-muted underline"
                data-testid="invest-to-analysis"
              >
                ← 분석 다시 보기
              </button>
              <p className="mt-1 text-[13px] text-muted" data-testid="invest-context">
                {invest.stockName} · {invest.title}
              </p>

              {invest.remarks.length > 0 && !outcome && (
                // 직원 의견은 투자 결정 화면에서 고르기 바로 앞에 본다 (378번). 같은 의견끼리 뭉친다 (242·246번): 의견마다 칸 하나, 그 의견을 낸 사람들의 이름(고집 표시)을 한 줄로 묶고, 한마디는 그 칸에서
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
                        aria-label={OPINIONS[g.read].label}
                        data-testid="opinion"
                        data-read={g.read}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h4 className="font-bold text-[14px]">{OPINIONS[g.read].label}</h4>
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
                            {others > 0 && (
                              <li className="text-[12px] text-muted">외 {others}명</li>
                            )}
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

              {debateFirst && (
                // 토론 (352번): 매수파·매도파가 맞붙어 한쪽으로 기운다. 접어 두면 결과 한 줄만 보이고 바로 고른다 (370번).
                <DebateFold
                  invest={invest}
                  choice={invest.teamCall ?? 'HOLD'}
                  open={debateOpen}
                  onToggle={setDebateOpen}
                >
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
                </DebateFold>
              )}
              {/* 차트가 아직 없는 토론 중에는 토론 장면 바로 밑에서 건너뛴다 (395번). */}
              {waiting && <SkipButton onSkip={skip} />}
              {!outcome && (
                <div
                  className="meeting-choices meeting-step-action grid grid-cols-2 gap-2"
                  data-testid="invest-options"
                >
                  {debateFirst && debateOpen && debated && (
                    <p
                      className="col-span-2 text-center text-[13px]"
                      data-testid="invest-your-turn"
                    >
                      직원들은{' '}
                      <b className={invest.teamCall === 'BUY' ? 'text-up' : 'text-down'}>
                        {invest.teamCall === 'BUY' ? '투자하자' : '매도하자'}
                      </b>{' '}
                      쪽으로 기울었다. 이제 <b>사장님 차례</b>입니다.
                    </p>
                  )}
                  {invest.options.map((o) => (
                    <button
                      key={o.code}
                      data-choice={o.code}
                      type="button"
                      disabled={busy || !invest.ready || waiting}
                      onClick={() => void decideInvest(o.code)}
                      className="min-h-12 rounded border border-pen font-semibold transition-transform hover:bg-pen hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      <span className="meeting-choice-icon" aria-hidden="true">
                        {o.code === 'BUY' ? '↗' : o.code === 'SELL' ? '↘' : '◉'}
                      </span>
                      {o.label}
                    </button>
                  ))}
                  {waiting && (
                    <p className="col-span-2 text-center text-[12px] text-muted">
                      토론이 끝나면 고를 수 있습니다.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {outcome && battleDone && (
            <div className="mt-3 grid gap-3" data-testid="invest-battle-summary">
              <p className="text-[13px] text-muted" data-testid="invest-context">
                {invest.stockName} · {invest.title}
              </p>
              <BattleAfter outcome={outcome} big />
              <button
                type="button"
                disabled={busy}
                onClick={onSettle}
                className="animate-reveal min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
                data-testid="invest-settle"
              >
                {year}년 차 {quarter}분기 넘기기 →
              </button>
            </div>
          )}
          {outcome && !hold && !battleDone && (
            <div className="mt-3" data-testid="invest-outcome">
              <p className="text-[13px] text-muted" data-testid="invest-context">
                {invest.stockName} · {invest.title}
              </p>
              {outcome.decisive != null && invest.sentences[outcome.decisive] && (
                // 기사는 분석 화면에 두고, 결과 화면에는 갈림길이 된 문장만 다시 보인다.
                <p
                  className="mt-1 rounded border border-line-soft px-2 py-1 text-[13px]"
                  data-testid="invest-decisive"
                >
                  <span className="decisive" style={{ animationDelay: `${show.reveal}ms` }}>
                    {invest.sentences[outcome.decisive].text}
                  </span>
                </p>
              )}
              {outcome.delegated && (
                <DebateFold
                  invest={invest}
                  choice={outcome.choice}
                  open={debateOpen}
                  onToggle={setDebateOpen}
                >
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
                    stock={invest.stockName}
                    instant={skipped}
                  />
                </DebateFold>
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
              {/* 빨리 보기는 차트 바로 밑에 (395번): 머리줄 구석의 밑줄 글씨는 찾기 어려웠다. 다 그려지면 사라진다. */}
              {!finished && <SkipButton onSkip={skip} />}
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
              {/* 실제 나온 회의 수익률을 크게, 띠 위에 점으로 (decisions.md 388번). */}
              <ReturnResult outcome={outcome} delay={show.total} />
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
                  <BattleAfter outcome={outcome} />
                  <div className="meeting-step-action grid gap-2">
                    {battleInOffice && outcome.battle?.open && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        className="min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
                        data-testid="invest-return-office"
                      >
                        사무실로 돌아가기
                      </button>
                    )}
                    {!battleInOffice && onBattle && outcome.battle?.open && (
                      <BattleEntryButton
                        mode={outcome.battle.mode}
                        disabled={busy}
                        onClick={() => outcome.battle && onBattle(outcome.battle)}
                        testId="invest-battle"
                      />
                    )}
                    {/* 사무실로 나가 전투를 미룰 수 있지만, 전투를 건너뛰고 분기를 넘길 수는 없다. 전투를 마치면 open이 꺼져 넘기기가 나온다. */}
                    {!(hasBattle && outcome.battle?.open) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onSettle}
                        className="animate-reveal min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
                        data-testid="invest-settle"
                      >
                        {year}년 차 {quarter}분기 넘기기 →
                      </button>
                    )}
                  </div>
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
 * 빨리 보기 (decisions.md 395번): 연출을 건너뛰고 끝난 모습을 보인다. 차트(토론) 바로 밑에 손가락으로 누르기 쉬운 크기로 둔다.
 */
function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="mt-2 min-h-12 w-full rounded border border-line bg-card font-semibold text-[14px] text-muted active:scale-95"
      data-testid="invest-skip"
    >
      빨리 보기 <span aria-hidden="true">⏩</span>
    </button>
  )
}

/**
 * 접어 둔 토론 (decisions.md 370번, #498): 결과 한 줄(어느 쪽이 우세했고 몇 대 몇)만 보이고, "토론 보기"를 누르면 맞붙는 토론이 나온다.
 */
function DebateFold({
  invest,
  choice,
  open,
  onToggle,
  children,
}: {
  invest: Invest
  choice: string
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  const buy = invest.remarks.filter((r) => r.read === 'UP').length
  const sell = invest.remarks.filter((r) => r.read === 'DOWN').length
  const side = choice === 'BUY' ? '매수파 우세' : choice === 'SELL' ? '매도파 우세' : '팽팽'
  return (
    <div className="mt-2" data-testid="debate-fold" data-open={open}>
      <div className="flex items-center justify-between gap-2 rounded bg-line-soft/60 px-2 py-1.5 text-[13px]">
        <p data-testid="debate-summary">
          <b className={choice === 'BUY' ? 'text-up' : choice === 'SELL' ? 'text-down' : ''}>
            {side}
          </b>{' '}
          · 매수 {buy} : 매도 {sell}
        </p>
        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          className="shrink-0 text-[12px] text-muted underline"
          data-testid="debate-toggle"
        >
          {open ? '토론 접기' : '토론 보기'}
        </button>
      </div>
      {open && children}
    </div>
  )
}

/**
 * 회의 뒤 전투를 했으면 전·후 회의 손익 (decisions.md 414번). big이면 전투를 마치고 돌아온 회의 창의 결과 한 장(#591): 별·배율·회의 손익 전→후를
 * 크게.
 */
function BattleAfter({
  outcome,
  big = false,
}: {
  outcome: NonNullable<Invest['outcome']>
  big?: boolean
}) {
  const b = outcome.battle
  if (!b || b.stars == null || b.after == null) return null
  if (big) {
    const assault = b.mode === 'ASSAULT'
    return (
      <section
        className="animate-reveal rounded-lg border-2 border-line bg-card px-3 py-4 text-center"
        data-testid="invest-battle-after"
        data-mode={b.mode}
      >
        <p className="font-bold text-[18px]">{assault ? '매도벽 돌파 결과' : '멘탈 방어 결과'}</p>
        <p
          className="mt-1 text-[40px] leading-none tracking-[6px]"
          role="img"
          aria-label={`별 ${b.stars}개`}
        >
          <span className="text-[#ffc83d]">{'★'.repeat(b.stars)}</span>
          <span className="text-ink/20">{'★'.repeat(3 - b.stars)}</span>
        </p>
        {assault && (
          <p className="mt-2 font-bold text-[26px] text-up">
            추가 수익 +{b.before > 0 ? Math.round(((b.after - b.before) / b.before) * 100) : 0}%
          </p>
        )}
        <p className="mt-2 text-[13px] text-muted">회의 손익</p>
        <p className="font-bold font-mono-num text-[22px]">
          {signed(b.before)} →{' '}
          <b className={b.after >= 0 ? 'text-up' : 'text-down'}>{signed(b.after)}</b>
        </p>
      </section>
    )
  }
  return (
    <p
      className="animate-reveal mt-2 rounded bg-line-soft px-3 py-2 text-center text-[14px]"
      data-testid="invest-battle-after"
    >
      {b.mode === 'ASSAULT' ? '매도벽 돌파' : '멘탈 방어'} {'★'.repeat(b.stars)}
      {'☆'.repeat(3 - b.stars)} · 회의 손익 {signed(b.before)} →{' '}
      <b className={b.after >= 0 ? 'text-up' : 'text-down'}>{signed(b.after)}</b>
    </p>
  )
}
