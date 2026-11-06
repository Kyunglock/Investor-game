import { useEffect, useState } from 'react'
import type { Company } from '../../api/client'
import { shortWon, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { TUG_DONE_MS, TugOfWar } from '../game/TugOfWar'
import {
  groupRemarks,
  hindsightOf,
  investTimeline,
  matchupOf,
  OPINIONS,
  spokesperson,
} from './investShow'
import { useRaisingStore } from './store'

type Invest = NonNullable<Company['invest']>

const STUBBORN: Record<string, { label: string; tone: string }> = {
  LOW: { label: '고집 낮음', tone: 'border-line text-muted' },
  MID: { label: '고집 보통', tone: 'border-gold text-gold' },
  HIGH: { label: '고집 높음 · 제멋대로 할지도', tone: 'border-wine text-wine' },
}

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
 * 그해 결산으로 넘어간다. 단서 기사를 놓고 직원들과 고민한다. 리서치 팀이 형광펜을 긋고, 자리에 앉은 직원이 한마디씩 하고(고집이 센 직원은 미리 티가
 * 난다), 사장이 고른다. 고르면 사장 결정에 도장이 찍히고, 돈을 굴리는 직원마다 **맞대결 막대**에서 사장 말과 꼬드김·제 판단이 엎치락뒤치락하다 이긴 쪽으로
 * 쭉 찬다(181번의 막대를 되살림). 다 끝나면 종목이 오르내린 것이 드러나고 직원마다 손익이 뜬다.
 */
export function InvestWindow({
  invest,
  year,
  employees,
  onClose,
  onSettle,
}: {
  invest: Invest
  year: number
  employees: Company['employees']
  onClose: () => void
  onSettle: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideInvest } = useRaisingStore.getState()
  const outcome = invest.outcome
  // 창을 열 때 이미 정한 회의면(다시 그림) 연출 없이 끝난 모습을 보인다.
  const [skipped, setSkipped] = useState(() => Boolean(outcome) || reducedMotion())
  const show = investTimeline(outcome?.results.length ?? 0, TUG_DONE_MS, skipped)
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
        <header className="flex items-baseline justify-between">
          <h3 className="font-pen text-[24px]">{year}년 차 종목 회의</h3>
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
                          {r.stubborn && (
                            <span
                              className={`rounded border px-1 text-[10px] ${STUBBORN[r.stubborn].tone}`}
                              data-testid="stubborn"
                            >
                              {STUBBORN[r.stubborn].label}
                            </span>
                          )}
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

        {!outcome && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {invest.options.map((o) => (
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
            {/* 크게 (260번): 판돈 두 배, 대신 직원이 사장 말을 덜 듣는다. 지켜보기는 크게 할 수 없다. */}
            {invest.options
              .filter((o) => o.code !== 'HOLD')
              .map((o) => (
                <button
                  key={`big-${o.code}`}
                  type="button"
                  disabled={busy || !invest.ready}
                  onClick={() => void decideInvest(o.code, true)}
                  className={`min-h-11 rounded border border-wine text-[14px] font-semibold text-wine transition-transform hover:bg-wine hover:text-white active:scale-95 disabled:opacity-50 ${
                    o.code === 'BUY' ? 'col-start-1' : 'col-start-3'
                  }`}
                >
                  크게 {o.label}
                </button>
              ))}
            <p className="col-span-3 text-center text-[12px] text-muted">
              크게 하면 판돈이 두 배, 직원이 사장 말을 안 들을 확률이 1.5배입니다.
            </p>
          </div>
        )}

        {outcome && (
          <div className="mt-3" data-testid="invest-outcome">
            <p className="flex items-center gap-2 text-[14px]">
              사장 결정
              <span
                className="animate-stamp pen-circle inline-block px-3 py-0.5 font-pen text-[22px] text-red-pen"
                data-testid="invest-choice"
              >
                {outcome.big ? `크게 ${label(outcome.choice)}` : label(outcome.choice)}
              </span>
            </p>
            <ul className="mt-2 grid gap-2">
              {outcome.results.map((r, i) => {
                const matchup = matchupOf(r, outcome.choice, label, employees, invest.sway.who)
                return (
                  <li
                    key={r.employeeId}
                    className="animate-reveal rounded border border-line-soft px-2 py-1.5 text-[14px]"
                    style={{ animationDelay: `${show.tugAt(i)}ms` }}
                    data-follow={r.follow}
                    data-testid="invest-result"
                  >
                    <p className="font-semibold">{r.name}</p>
                    {matchup ? (
                      <TugOfWar
                        // 빨리 보기를 누르면 끝난 막대로 다시 그린다.
                        key={String(skipped)}
                        matchup={matchup}
                        delay={show.tugAt(i)}
                        instant={skipped}
                      />
                    ) : (
                      <OneVoice action={label(r.action)} delay={show.tugAt(i)} />
                    )}
                    <p
                      className="animate-reveal mt-1 flex flex-wrap items-baseline justify-between gap-x-2"
                      style={{ animationDelay: `${show.pnlAt(i)}ms` }}
                    >
                      <span>
                        {r.follow !== 'BOSS' && (
                          <span
                            className={`mr-1 rounded px-1 text-[11px] ${FOLLOW[r.follow].tone}`}
                          >
                            {FOLLOW[r.follow].label}
                          </span>
                        )}
                        {r.line}
                      </span>
                      <b className={`text-[16px] ${r.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                        {signed(r.pnl)}
                      </b>
                    </p>
                  </li>
                )
              })}
            </ul>
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
                <p
                  className="animate-reveal mt-3 rounded bg-line-soft px-3 py-2 text-center text-[13px]"
                  data-testid="invest-next"
                >
                  회의는 이 <b>한 건</b>으로 끝났습니다. 이제 직원들이 <b>1년 동안</b> 배치대로 굴린
                  결과를 봅니다.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSettle}
                  className="animate-reveal mt-2 min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
                >
                  {year}년 차 결산 보기 →
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </Overlay>
  )
}

/** 사장 말과 맞붙을 것이 없었던 직원: 막대가 한쪽으로 곧장 찬다. */
function OneVoice({ action, delay }: { action: string; delay: number }) {
  return (
    <div
      className="mt-1 relative h-11 overflow-hidden rounded-md bg-teal-soft"
      data-testid="one-voice"
    >
      <div
        className="animate-fill absolute inset-y-0 left-0 bg-teal"
        style={{ animationDelay: `${delay}ms` }}
      />
      <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-3 leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
        <span className="text-[14px] font-black">{action}</span>
        <span className="text-[10px] font-bold opacity-85">한마음</span>
      </div>
    </div>
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
